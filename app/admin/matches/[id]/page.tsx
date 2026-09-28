import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { AdminNav } from '@/app/admin/AdminNav';
import {
  backToDraftAction,
  closeVotingAction,
  deleteMatchAction,
  reopenVotingAction,
  saveDraftAction,
  saveSelectionAction,
  unpublishAction,
} from '@/app/admin/actions';
import { CopyButton } from '@/components/CopyButton';
import { Header } from '@/components/Header';
import { Notice } from '@/components/Notice';
import { ResultsView } from '@/components/ResultsView';
import { SubmitButton } from '@/components/SubmitButton';
import { sql } from '@/lib/db';
import { NEUTRAL_LABEL, STATUS_LABEL, formatDate, teamClass } from '@/lib/format';
import { type TeamTally, getMatch, getParticipation, getTally, getTeamsWithPlayers } from '@/lib/queries';
import { requireAdmin } from '@/lib/session';
import type { Match, MatchStatus } from '@/lib/types';
import { type RosterChoice, RosterEditor } from './RosterEditor';

const STEPS: { status: MatchStatus; label: string; hint: string }[] = [
  { status: 'draft', label: '명단 편성', hint: '출전 선수를 팀에 배정하고 투표를 여세요.' },
  { status: 'open', label: '투표 진행', hint: '단톡방에 링크를 공유하고, 다 모이면 마감하세요.' },
  { status: 'closed', label: 'MOM 선정', hint: '득표와 이유를 보고 팀별 MOM을 골라 발표하세요.' },
  { status: 'published', label: '결과 발표', hint: '팀원 모두가 결과를 볼 수 있습니다.' },
];

function Steps({ status }: { status: MatchStatus }) {
  const current = STEPS.findIndex((s) => s.status === status);
  return (
    <div className="stack-sm">
      <ol className="steps" aria-label="진행 단계">
        {STEPS.map((step, i) => (
          <li key={step.status} className={i < current ? 'done' : i === current ? 'current' : undefined} aria-current={i === current ? 'step' : undefined}>
            <span className="step-dot">{i < current ? '✓' : i + 1}</span>
            <span className="step-label">{step.label}</span>
          </li>
        ))}
      </ol>
      <p className="step-hint">{STEPS[current].hint}</p>
    </div>
  );
}

export default async function AdminMatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; tone?: 'success' | 'error' }>;
}) {
  const member = await requireAdmin();
  const { id } = await params;
  const { msg, tone } = await searchParams;
  const match = await getMatch(id);
  if (!match) notFound();

  return (
    <>
      <Header member={member} />
      <main className="stack">
        <AdminNav current="matches" />
        <div className="page-title stack-sm">
          <div className="row">
            <Link href="/admin" className="small">← 경기 목록</Link>
          </div>
          <div className="row">
            <h1>{match.title}</h1>
            <span className={`badge badge-${match.status}`}>{STATUS_LABEL[match.status]}</span>
          </div>
          <p className="muted" style={{ margin: 0 }}>{formatDate(match.match_date)}</p>
        </div>
        <Steps status={match.status} />
        <Notice message={msg} tone={tone} />

        {match.status === 'draft' && <DraftSection match={match} />}
        {match.status === 'open' && <OpenSection match={match} />}
        {match.status === 'closed' && <ClosedSection match={match} />}
        {match.status === 'published' && <PublishedSection match={match} />}

        <details className="danger-zone">
          <summary>경기 삭제</summary>
          <form action={deleteMatchAction} className="stack-sm">
            <input type="hidden" name="matchId" value={match.id} />
            <p className="muted small" style={{ margin: 0 }}>투표 기록과 결과까지 모두 지워지며 되돌릴 수 없습니다.</p>
            <SubmitButton
              className="btn btn-danger btn-small"
              confirmMessage={`'${match.title}'을(를) 삭제할까요? 투표 기록과 결과도 모두 지워지며 되돌릴 수 없습니다.`}
            >
              이 경기 삭제
            </SubmitButton>
          </form>
        </details>
      </main>
    </>
  );
}

// ── 준비: 경기 정보 + 출전 명단 편성 ─────────────────────────

async function DraftSection({ match }: { match: Match }) {
  const teams = await getTeamsWithPlayers(match.id);
  const members = await sql<{ id: string; name: string }[]>`
    select id, name from members where active
    union
    select m.id, m.name from team_players tp join members m on m.id = tp.member_id where tp.match_id = ${match.id}
    order by name
  `;
  const initial: Record<string, RosterChoice> = {};
  for (const team of teams) {
    for (const p of team.players) initial[p.id] = p.neutral ? 'neutral' : team.id;
  }

  return (
    <form action={saveDraftAction} className="stack">
      <input type="hidden" name="matchId" value={match.id} />
      <section className="card stack">
        <h2>경기 정보</h2>
        <label className="field">
          경기 이름
          <input id="title" type="text" name="title" defaultValue={match.title} required maxLength={50} />
        </label>
        <label className="field">
          경기 날짜
          <input id="date" type="date" name="date" defaultValue={match.match_date} required />
        </label>
        <div className="grid-2">
          {teams.map((t, i) => (
            <label key={t.id} className="field">
              {i === 0 ? '첫 번째' : '두 번째'} 팀 이름
              <input id={`team-name-${t.id}`} type="text" name={`teamName_${t.id}`} defaultValue={t.name} required maxLength={20} />
            </label>
          ))}
        </div>
      </section>

      <section className="card stack">
        <h2>출전 명단</h2>
        {members.length === 0 ? (
          <Notice message="등록된 회원이 없습니다. 회원 관리에서 먼저 팀원을 추가해 주세요." />
        ) : (
          <RosterEditor members={members} teams={teams} initial={initial} />
        )}
      </section>

      <div className="action-bar stack-sm">
        <SubmitButton
          className="btn btn-primary btn-block"
          name="intent"
          value="open"
          confirmMessage="이 명단으로 투표를 열까요? 누군가 투표한 뒤에는 명단을 바꿀 수 없습니다."
        >
          저장하고 투표 열기
        </SubmitButton>
        <SubmitButton className="btn btn-secondary btn-block" name="intent" value="save">
          저장만 하기
        </SubmitButton>
      </div>
    </form>
  );
}

// ── 투표 중: 참여 현황 + 마감 ─────────────────────────────

async function OpenSection({ match }: { match: Match }) {
  const participation = await getParticipation(match.id);
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`;
  const percent = participation.eligible ? Math.round((participation.voted / participation.eligible) * 100) : 0;

  const shareText = `[${match.title}] MOM 투표가 열렸습니다!\n${origin}`;
  const remindText = `[${match.title}] MOM 투표 아직 안 하신 분: ${participation.notVoted
    .map((p) => p.name)
    .join(', ')}\n${origin}`;

  return (
    <>
      <section className="card stack">
        <div className="row-between">
          <h2>참여 현황</h2>
          <strong className="num">
            {participation.voted}/{participation.eligible}명
          </strong>
        </div>
        <div className="progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <div style={{ width: `${percent}%` }} />
        </div>
        {participation.notVoted.length > 0 ? (
          <>
            <p className="section-label">아직 투표하지 않은 사람</p>
            <p style={{ margin: 0 }}>{participation.notVoted.map((p) => p.name).join(', ')}</p>
            <div className="row">
              <CopyButton text={shareText} label="투표 안내 문구 복사" />
              <CopyButton text={remindText} label="독촉 문구 복사" />
            </div>
          </>
        ) : (
          <Notice tone="success" message="출전 선수 모두 투표했습니다." />
        )}
        <p className="muted small" style={{ margin: 0 }}>
          투표는 익명이라 누가 누구를 뽑았는지는 관리자도 볼 수 없습니다. 득표 현황은 마감 뒤에 공개됩니다.
        </p>
      </section>

      <form action={closeVotingAction}>
        <input type="hidden" name="matchId" value={match.id} />
        <SubmitButton
          className="btn btn-primary btn-block"
          confirmMessage={`투표를 마감할까요? (${participation.voted}/${participation.eligible}명 참여) 마감 뒤에는 더 이상 투표할 수 없습니다.`}
        >
          투표 마감
        </SubmitButton>
      </form>

      {participation.voted === 0 && (
        <form action={backToDraftAction}>
          <input type="hidden" name="matchId" value={match.id} />
          <SubmitButton className="btn btn-secondary btn-block">명단 수정으로 돌아가기</SubmitButton>
        </form>
      )}
    </>
  );
}

// ── 마감: 집계 확인 + 최종 MOM 선정 ─────────────────────────

async function ClosedSection({ match }: { match: Match }) {
  const [tally, participation] = await Promise.all([getTally(match.id), getParticipation(match.id)]);

  return (
    <>
      <form action={saveSelectionAction} className="stack">
        <input type="hidden" name="matchId" value={match.id} />
        <p className="muted small" style={{ margin: 0 }}>
          출전 선수 {participation.eligible}명 중 {participation.voted}명 투표. 최다 득표자가 기본으로 선택되어 있고, 다른 선수로 바꿀 수 있습니다.
        </p>
        {tally.map((team) => (
          <TallyCard key={team.id} team={team} />
        ))}
        <div className="action-bar stack-sm">
          <SubmitButton
            className="btn btn-primary btn-block"
            name="intent"
            value="publish"
            confirmMessage="결과를 발표할까요? 팀원 모두가 MOM, 득표수, 이유를 볼 수 있게 됩니다."
          >
            저장하고 결과 발표
          </SubmitButton>
          <SubmitButton className="btn btn-secondary btn-block" name="intent" value="save">
            저장만 하기
          </SubmitButton>
        </div>
        <Link href={`/results/${match.id}`} className="small" style={{ textAlign: 'center' }}>
          저장한 내용으로 결과 화면 미리보기
        </Link>
      </form>

      <form action={reopenVotingAction}>
        <input type="hidden" name="matchId" value={match.id} />
        <SubmitButton className="btn btn-secondary btn-block" confirmMessage="투표를 다시 열까요?">
          투표 다시 열기
        </SubmitButton>
      </form>
    </>
  );
}

function TallyCard({ team }: { team: TeamTally }) {
  const top = team.candidates[0];
  const tied = team.candidates.filter((c) => top && c.votes === top.votes && c.votes > 0).length > 1;
  const selected = team.result?.memberId ?? (top && top.votes > 0 && !tied ? top.id : undefined);

  return (
    <fieldset className={`card team-card stack ${teamClass(team.sort_order)}`} style={{ margin: 0 }}>
      <legend className="sr-only">{team.name} MOM 선정</legend>
      <div className="row-between">
        <h2 className="team-name">{team.name}</h2>
        <span className="muted small num">총 {team.totalVotes}표</span>
      </div>
      {tied && !team.result && <Notice message="최다 득표가 동점입니다. 이유를 읽어 보고 한 명을 선택해 주세요." />}

      <div className="stack-sm">
        {team.candidates.map((c) => (
          <div key={c.id} className="stack-sm" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
            <label className="row-between" style={{ cursor: 'pointer' }}>
              <span className="row">
                <input type="radio" name={`mom_${team.id}`} value={c.id} defaultChecked={selected === c.id} />
                <strong>{c.name}</strong>
                {c.neutral && <span className="tag">{NEUTRAL_LABEL}</span>}
              </span>
              <span className="num">{c.votes}표</span>
            </label>
            {c.reasons.length > 0 && (
              <ul className="reasons">
                {c.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <label className="field">
        선정 코멘트 (선택)
        <textarea
          id={`comment-${team.id}`}
          name={`comment_${team.id}`}
          defaultValue={team.result?.comment ?? ''}
          maxLength={300}
          placeholder="결과 화면에 함께 표시됩니다"
        />
      </label>
    </fieldset>
  );
}

// ── 발표 완료 ────────────────────────────────────────────

async function PublishedSection({ match }: { match: Match }) {
  const [tally, participation] = await Promise.all([getTally(match.id), getParticipation(match.id)]);
  return (
    <>
      <Notice tone="success" message="결과가 발표되었습니다. 팀원들이 홈 화면에서 볼 수 있습니다." />
      <ResultsView tally={tally} participation={participation} />
      <form action={unpublishAction}>
        <input type="hidden" name="matchId" value={match.id} />
        <SubmitButton className="btn btn-secondary btn-block" confirmMessage="발표를 취소하고 선정 단계로 돌아갈까요?">
          발표 취소하고 다시 선정하기
        </SubmitButton>
      </form>
    </>
  );
}
