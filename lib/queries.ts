import { isUuid, sql } from './db';
import type { Match, Player, RosterPlayer, Team, TeamWithPlayers } from './types';

export async function getMatch(id: string): Promise<Match | null> {
  if (!isUuid(id)) return null;
  const [match] = await sql<Match[]>`
    select id, title, to_char(match_date, 'YYYY-MM-DD') as match_date, status
    from matches where id = ${id}
  `;
  return match ?? null;
}

export async function listMatches(statuses?: Match['status'][]): Promise<Match[]> {
  return sql<Match[]>`
    select id, title, to_char(match_date, 'YYYY-MM-DD') as match_date, status
    from matches
    ${statuses ? sql`where status in ${sql(statuses)}` : sql``}
    order by match_date desc, created_at desc
  `;
}

export async function getTeamsWithPlayers(matchId: string): Promise<TeamWithPlayers[]> {
  const teams = await sql<Team[]>`
    select id, name, sort_order from teams where match_id = ${matchId} order by sort_order
  `;
  const players = await sql<(Player & { team_id: string })[]>`
    select tp.team_id, m.id, m.name
    from team_players tp join members m on m.id = tp.member_id
    where tp.match_id = ${matchId}
    order by m.name
  `;
  const teamCount = new Map<string, number>();
  for (const p of players) teamCount.set(p.id, (teamCount.get(p.id) ?? 0) + 1);

  return teams.map((team) => ({
    ...team,
    players: players
      .filter((p) => p.team_id === team.id)
      .map(({ id, name }) => ({ id, name, neutral: (teamCount.get(id) ?? 0) > 1 })),
  }));
}

export async function isPlayer(matchId: string, memberId: string): Promise<boolean> {
  const rows = await sql`
    select 1 from team_players where match_id = ${matchId} and member_id = ${memberId}
  `;
  return rows.length > 0;
}

export async function hasVoted(matchId: string, memberId: string): Promise<boolean> {
  const rows = await sql`
    select 1 from participations where match_id = ${matchId} and member_id = ${memberId}
  `;
  return rows.length > 0;
}

export type Participation = { eligible: number; voted: number; notVoted: Player[] };

export async function getParticipation(matchId: string): Promise<Participation> {
  const rows = await sql<(Player & { voted: boolean })[]>`
    select m.id, m.name,
           exists (select 1 from participations p where p.match_id = ${matchId} and p.member_id = m.id) as voted
    from members m
    where m.id in (select member_id from team_players where match_id = ${matchId})
    order by m.name
  `;
  return {
    eligible: rows.length,
    voted: rows.filter((r) => r.voted).length,
    notVoted: rows.filter((r) => !r.voted).map(({ id, name }) => ({ id, name })),
  };
}

export type Candidate = RosterPlayer & { votes: number; reasons: string[] };
export type TeamTally = Team & {
  totalVotes: number;
  candidates: Candidate[]; // 득표 많은 순
  result: { memberId: string; comment: string | null } | null;
};

/** 팀별 득표 집계. 표에는 투표자 정보가 없으므로 이유도 익명으로만 나옵니다. */
export async function getTally(matchId: string): Promise<TeamTally[]> {
  const teams = await getTeamsWithPlayers(matchId);
  const votes = await sql<{ team_id: string; candidate_id: string; reason: string }[]>`
    select team_id, candidate_id, reason from votes where match_id = ${matchId} order by id
  `;
  const results = await sql<{ team_id: string; member_id: string; comment: string | null }[]>`
    select team_id, member_id, comment from mom_results where match_id = ${matchId}
  `;

  return teams.map((team) => {
    const teamVotes = votes.filter((v) => v.team_id === team.id);
    const candidates = team.players
      .map((player) => {
        const mine = teamVotes.filter((v) => v.candidate_id === player.id);
        // 이유는 선택 사항이라 빈 값은 목록에서 뺍니다.
        return { ...player, votes: mine.length, reasons: mine.map((v) => v.reason).filter(Boolean) };
      })
      .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name, 'ko'));
    const result = results.find((r) => r.team_id === team.id);

    return {
      ...team,
      totalVotes: teamVotes.length,
      candidates,
      result: result ? { memberId: result.member_id, comment: result.comment } : null,
    };
  });
}

export type MomRecord = { match_id: string; team_name: string; sort_order: number; name: string };

export async function getPublishedMoms(): Promise<MomRecord[]> {
  return sql<MomRecord[]>`
    select r.match_id, t.name as team_name, t.sort_order, m.name
    from mom_results r
    join matches mt on mt.id = r.match_id and mt.status = 'published'
    join teams t on t.id = r.team_id
    join members m on m.id = r.member_id
    order by t.sort_order
  `;
}

export type RevealCard = { id: string; team_id: string; name: string; reason: string; indexInTeam: number };
export type RevealTeam = Team & {
  total: number; // 이 팀에 들어온 전체 표 수
  revealed: number; // 지금까지 공개된 표 수
  tally: { name: string; votes: number }[]; // 공개된 표 기준, 많은 순
};
export type RevealState = { started: boolean; pos: number; total: number; current: RevealCard | null; teams: RevealTeam[] };

/**
 * 개표 화면 상태. 아직 공개하지 않은 표는 조회하지 않아서 화면(네트워크)으로 미리 새어 나가지 않습니다.
 */
export async function getReveal(matchId: string): Promise<RevealState> {
  const [match] = await sql<{ reveal_order: string[] | null; reveal_pos: number }[]>`
    select reveal_order, reveal_pos from matches where id = ${matchId}
  `;
  const teams = await sql<(Team & { total: number })[]>`
    select t.id, t.name, t.sort_order, count(v.id)::int as total
    from teams t left join votes v on v.team_id = t.id
    where t.match_id = ${matchId}
    group by t.id
    order by t.sort_order
  `;

  const order = match?.reveal_order ?? [];
  const pos = Math.min(match?.reveal_pos ?? 0, order.length);
  const shownIds = order.slice(0, pos);
  const rows = shownIds.length
    ? await sql<{ id: string; team_id: string; name: string; reason: string }[]>`
        select v.id, v.team_id, m.name, v.reason
        from votes v join members m on m.id = v.candidate_id
        where v.id in ${sql(shownIds)}
      `
    : [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const shown = shownIds.map((id) => byId.get(id)).filter((r) => r !== undefined);

  const last = shown.at(-1);
  const current = last
    ? { ...last, indexInTeam: shown.filter((v) => v.team_id === last.team_id).length }
    : null;

  return {
    started: match?.reveal_order != null,
    pos,
    total: order.length,
    current,
    teams: teams.map((team) => {
      const mine = shown.filter((v) => v.team_id === team.id);
      const counts = new Map<string, number>();
      for (const v of mine) counts.set(v.name, (counts.get(v.name) ?? 0) + 1);
      return {
        ...team,
        revealed: mine.length,
        tally: [...counts]
          .map(([name, votes]) => ({ name, votes }))
          .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name, 'ko')),
      };
    }),
  };
}
