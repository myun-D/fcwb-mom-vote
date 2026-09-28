'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isUuid, sql } from '@/lib/db';
import { DEFAULT_TEAM_NAMES } from '@/lib/format';
import { requireAdmin } from '@/lib/session';
import type { MatchStatus } from '@/lib/types';

function done(path: string, msg: string, tone: 'success' | 'error' = 'success'): never {
  revalidatePath('/', 'layout');
  redirect(`${path}?tone=${tone}&msg=${encodeURIComponent(msg)}`);
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

/** 현재 상태가 from일 때만 to로 바꿉니다. 바뀌었으면 true. */
async function transition(matchId: string, from: MatchStatus, to: MatchStatus): Promise<boolean> {
  const rows = await sql`
    update matches
    set status = ${to}, published_at = ${to === 'published' ? sql`now()` : null}
    where id = ${matchId} and status = ${from}
    returning id
  `;
  return rows.length > 0;
}

function matchIdFrom(formData: FormData): string {
  const id = text(formData, 'matchId');
  if (!isUuid(id)) redirect('/admin');
  return id;
}

const matchPath = (id: string) => `/admin/matches/${id}`;

// ── 경기 ──────────────────────────────────────────────

export async function createMatchAction(formData: FormData) {
  await requireAdmin();
  const title = text(formData, 'title');
  const date = text(formData, 'date');
  const teamA = text(formData, 'teamA') || DEFAULT_TEAM_NAMES[0];
  const teamB = text(formData, 'teamB') || DEFAULT_TEAM_NAMES[1];
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) done('/admin/matches/new', '경기 이름과 날짜를 입력해 주세요.', 'error');

  const id = await sql.begin(async (tx) => {
    const [match] = await tx<{ id: string }[]>`
      insert into matches (title, match_date) values (${title}, ${date}) returning id
    `;
    await tx`
      insert into teams (match_id, name, sort_order)
      values (${match.id}, ${teamA}, 0), (${match.id}, ${teamB}, 1)
    `;
    return match.id;
  });
  done(matchPath(id), '경기를 만들었습니다. 출전 선수를 팀에 배정해 주세요.');
}

/**
 * 준비 단계에서 경기 정보와 출전 명단을 저장합니다.
 * intent=open이면 저장한 명단으로 바로 투표를 엽니다.
 */
export async function saveDraftAction(formData: FormData) {
  await requireAdmin();
  const matchId = matchIdFrom(formData);
  const openAfterSave = text(formData, 'intent') === 'open';
  const title = text(formData, 'title');
  const date = text(formData, 'date');
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) done(matchPath(matchId), '경기 이름과 날짜를 입력해 주세요.', 'error');

  const teams = await sql<{ id: string }[]>`select id from teams where match_id = ${matchId}`;
  const teamIds = new Set(teams.map((t) => t.id));

  const assignments: { team_id: string; member_id: string }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('player_')) continue;
    const memberId = key.slice('player_'.length);
    const choice = String(value);
    if (!isUuid(memberId)) continue;
    // 중립: 인원이 홀수일 때 두 팀 모두에서 뛰는 선수
    const targets = choice === 'neutral' ? [...teamIds] : teamIds.has(choice) ? [choice] : [];
    for (const teamId of targets) assignments.push({ team_id: teamId, member_id: memberId });
  }

  const ok = await sql.begin(async (tx) => {
    const [match] = await tx`select status from matches where id = ${matchId} for update`;
    if (match?.status !== 'draft') return false;

    await tx`update matches set title = ${title}, match_date = ${date} where id = ${matchId}`;
    for (const team of teams) {
      const name = text(formData, `teamName_${team.id}`);
      if (name) await tx`update teams set name = ${name} where id = ${team.id}`;
    }
    await tx`delete from team_players where match_id = ${matchId}`;
    if (assignments.length > 0) {
      await tx`
        insert into team_players ${tx(assignments.map((a) => ({ ...a, match_id: matchId })))}
      `;
    }
    return true;
  });

  if (!ok) done(matchPath(matchId), '준비 중인 경기만 수정할 수 있습니다.', 'error');
  if (openAfterSave) await openVoting(matchId);
  done(matchPath(matchId), '명단을 저장했습니다.');
}

async function openVoting(matchId: string): Promise<never> {
  const counts = await sql<{ name: string; players: number }[]>`
    select t.name, count(tp.member_id)::int as players
    from teams t left join team_players tp on tp.team_id = t.id
    where t.match_id = ${matchId}
    group by t.id, t.name
  `;
  const short = counts.find((c) => c.players < 2);
  if (short) done(matchPath(matchId), `명단은 저장했습니다. 다만 ${short.name} 선수가 2명 이상이어야 투표를 열 수 있습니다.`, 'error');

  if (!(await transition(matchId, 'draft', 'open'))) done(matchPath(matchId), '준비 중인 경기만 투표를 열 수 있습니다.', 'error');
  done(matchPath(matchId), '투표를 열었습니다. 단톡방에 링크를 공유해 주세요.');
}

/** 아무도 투표하지 않았을 때만 명단 수정 단계로 되돌립니다. */
export async function backToDraftAction(formData: FormData) {
  await requireAdmin();
  const matchId = matchIdFrom(formData);
  const rows = await sql`
    update matches set status = 'draft'
    where id = ${matchId} and status = 'open'
      and not exists (select 1 from participations where match_id = ${matchId})
    returning id
  `;
  if (rows.length === 0) done(matchPath(matchId), '이미 투표한 사람이 있어 명단을 바꿀 수 없습니다.', 'error');
  done(matchPath(matchId), '준비 단계로 돌아왔습니다.');
}

export async function closeVotingAction(formData: FormData) {
  await requireAdmin();
  const matchId = matchIdFrom(formData);
  if (!(await transition(matchId, 'open', 'closed'))) done(matchPath(matchId), '투표 중인 경기가 아닙니다.', 'error');
  done(matchPath(matchId), '투표를 마감했습니다. 팀별 MOM을 선정해 주세요.');
}

export async function reopenVotingAction(formData: FormData) {
  await requireAdmin();
  const matchId = matchIdFrom(formData);
  if (!(await transition(matchId, 'closed', 'open'))) done(matchPath(matchId), '마감된 경기만 다시 열 수 있습니다.', 'error');
  // 표가 더 들어올 수 있으니 진행하던 개표는 처음부터 다시 합니다.
  await sql`update matches set reveal_order = null, reveal_pos = 0 where id = ${matchId}`;
  done(matchPath(matchId), '투표를 다시 열었습니다.');
}

/** 팀별 최종 MOM을 저장하고, intent=publish면 발표까지 합니다. */
export async function saveSelectionAction(formData: FormData) {
  await requireAdmin();
  const matchId = matchIdFrom(formData);
  const publish = text(formData, 'intent') === 'publish';

  const players = await sql<{ team_id: string; member_id: string }[]>`
    select team_id, member_id from team_players where match_id = ${matchId}
  `;
  const teams = await sql<{ id: string }[]>`select id from teams where match_id = ${matchId}`;

  const picks = teams.map((t) => ({
    team_id: t.id,
    member_id: text(formData, `mom_${t.id}`),
    comment: text(formData, `comment_${t.id}`) || null,
  }));
  const valid = picks.filter((p) =>
    players.some((pl) => pl.team_id === p.team_id && pl.member_id === p.member_id),
  );
  if (publish && valid.length !== teams.length) done(matchPath(matchId), '발표하려면 모든 팀의 MOM을 선택해 주세요.', 'error');

  const ok = await sql.begin(async (tx) => {
    const [match] = await tx`select status from matches where id = ${matchId} for update`;
    if (match?.status !== 'closed') return false;
    for (const p of valid) {
      await tx`
        insert into mom_results (team_id, match_id, member_id, comment)
        values (${p.team_id}, ${matchId}, ${p.member_id}, ${p.comment})
        on conflict (team_id) do update set member_id = excluded.member_id, comment = excluded.comment
      `;
    }
    if (publish) await tx`update matches set status = 'published', published_at = now() where id = ${matchId}`;
    return true;
  });

  if (!ok) done(matchPath(matchId), '마감된 경기에서만 MOM을 선정할 수 있습니다.', 'error');
  done(matchPath(matchId), publish ? '결과를 발표했습니다. 팀원들이 결과를 볼 수 있습니다.' : '선정 내용을 저장했습니다.');
}

export async function unpublishAction(formData: FormData) {
  await requireAdmin();
  const matchId = matchIdFrom(formData);
  if (!(await transition(matchId, 'published', 'closed'))) done(matchPath(matchId), '발표된 경기가 아닙니다.', 'error');
  done(matchPath(matchId), '발표를 취소했습니다. 결과가 팀원들에게 보이지 않습니다.');
}

export async function deleteMatchAction(formData: FormData) {
  await requireAdmin();
  const matchId = matchIdFrom(formData);
  await sql`delete from matches where id = ${matchId}`;
  done('/admin', '경기를 삭제했습니다.');
}

// ── 회원 ──────────────────────────────────────────────

export async function addMembersAction(formData: FormData) {
  await requireAdmin();
  const names = [
    ...new Set(
      text(formData, 'names')
        .split(/[\n,]/)
        .map((n) => n.trim())
        .filter(Boolean),
    ),
  ];
  const tooLong = names.find((n) => n.length > 20);
  if (tooLong) done('/admin/members', `이름은 20자 이내로 입력해 주세요: ${tooLong}`, 'error');
  if (names.length === 0) done('/admin/members', '추가할 이름을 입력해 주세요.', 'error');

  const inserted = await sql`
    insert into members ${sql(names.map((name) => ({ name })))}
    on conflict (name) do nothing
    returning id
  `;
  const skipped = names.length - inserted.length;
  done('/admin/members', `${inserted.length}명을 추가했습니다.${skipped ? ` (이미 있는 이름 ${skipped}명 제외)` : ''}`);
}

export async function resetPinAction(formData: FormData) {
  await requireAdmin();
  const memberId = text(formData, 'memberId');
  if (!isUuid(memberId)) redirect('/admin/members');
  const [member] = await sql<{ name: string }[]>`
    update members
    set pin_hash = null, failed_attempts = 0, locked_until = null, session_version = session_version + 1
    where id = ${memberId}
    returning name
  `;
  done('/admin/members', `${member?.name ?? ''}님의 PIN을 초기화했습니다. 다음 접속 때 새 PIN을 만듭니다.`);
}

export async function toggleAdminAction(formData: FormData) {
  const me = await requireAdmin();
  const memberId = text(formData, 'memberId');
  if (!isUuid(memberId)) redirect('/admin/members');
  if (memberId === me.id) done('/admin/members', '본인의 관리자 권한은 해제할 수 없습니다.', 'error');
  await sql`update members set is_admin = not is_admin where id = ${memberId}`;
  done('/admin/members', '관리자 권한을 변경했습니다.');
}

export async function toggleActiveAction(formData: FormData) {
  const me = await requireAdmin();
  const memberId = text(formData, 'memberId');
  if (!isUuid(memberId)) redirect('/admin/members');
  if (memberId === me.id) done('/admin/members', '본인은 비활성화할 수 없습니다.', 'error');
  await sql`update members set active = not active where id = ${memberId}`;
  done('/admin/members', '회원 상태를 변경했습니다.');
}
