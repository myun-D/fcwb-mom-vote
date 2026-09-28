import { notFound, redirect } from 'next/navigation';
import { Header } from '@/components/Header';
import { getMatch, getReveal } from '@/lib/queries';
import { requireMember } from '@/lib/session';
import { LiveView } from './LiveView';

export default async function LivePage({ params }: { params: Promise<{ matchId: string }> }) {
  const member = await requireMember();
  const { matchId } = await params;
  const match = await getMatch(matchId);
  if (!match) notFound();
  if (match.status === 'published') redirect(`/results/${match.id}`);
  if (match.status !== 'closed') redirect('/?msg=' + encodeURIComponent('투표가 마감된 뒤에 개표를 볼 수 있습니다.'));

  const reveal = await getReveal(match.id);

  return (
    <>
      <Header member={member} />
      <main className="stack">
        <div className="page-title">
          <h1>{match.title} 개표</h1>
        </div>
        <LiveView matchId={match.id} isAdmin={member.is_admin} initial={reveal} />
      </main>
    </>
  );
}
