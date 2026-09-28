import { redirect } from 'next/navigation';
import { Header } from '@/components/Header';
import { formatDate } from '@/lib/format';
import { getMatch, getTeamsWithPlayers, hasVoted } from '@/lib/queries';
import { requireMember } from '@/lib/session';
import { VoteForm } from './VoteForm';

export default async function VotePage({ params }: { params: Promise<{ matchId: string }> }) {
  const member = await requireMember();
  const { matchId } = await params;

  const match = await getMatch(matchId);
  if (!match || match.status !== 'open') redirect('/?msg=' + encodeURIComponent('지금은 투표 기간이 아닙니다.'));

  const teams = await getTeamsWithPlayers(match.id);
  const isMine = (t: (typeof teams)[number]) => t.players.some((p) => p.id === member.id);
  if (!teams.some(isMine)) redirect('/?msg=' + encodeURIComponent('이번 경기 출전 선수만 투표할 수 있습니다.'));
  if (await hasVoted(match.id, member.id)) redirect('/');

  // 본인은 후보에서 뺍니다.
  const candidates = teams.map((t) => ({
    ...t,
    isMine: isMine(t),
    players: t.players.filter((p) => p.id !== member.id),
  }));

  return (
    <>
      <Header member={member} />
      <main className="stack">
        <div className="page-title">
          <h1>{match.title}</h1>
          <p className="muted">{formatDate(match.match_date)}</p>
        </div>
        <VoteForm matchId={match.id} teams={candidates} />
      </main>
    </>
  );
}
