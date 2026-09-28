export type MatchStatus = 'draft' | 'open' | 'closed' | 'published';

export type Member = {
  id: string;
  name: string;
  is_admin: boolean;
};

export type Match = {
  id: string;
  title: string;
  match_date: string; // YYYY-MM-DD
  status: MatchStatus;
};

export type Player = { id: string; name: string };

export type Team = {
  id: string;
  name: string;
  sort_order: number;
};

/** neutral: 인원이 홀수라 두 팀 모두에서 뛴 선수 */
export type RosterPlayer = Player & { neutral: boolean };

export type TeamWithPlayers = Team & { players: RosterPlayer[] };
