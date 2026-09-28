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
        return { ...player, votes: mine.length, reasons: mine.map((v) => v.reason) };
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

export type MomRanking = { name: string; count: number };

/** 발표된 경기 기준 사람별 누적 MOM 횟수 */
export async function getMomRanking(): Promise<MomRanking[]> {
  return sql<MomRanking[]>`
    select m.name, count(*)::int as count
    from mom_results r
    join matches mt on mt.id = r.match_id and mt.status = 'published'
    join members m on m.id = r.member_id
    group by m.name
    order by count desc, m.name
  `;
}
