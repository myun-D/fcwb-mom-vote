import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/Header';
import { Notice } from '@/components/Notice';
import { ResultsView } from '@/components/ResultsView';
import { formatDate } from '@/lib/format';
import { getMatch, getParticipation, getTally } from '@/lib/queries';
import { requireMember } from '@/lib/session';

export default async function ResultsPage({ params }: { params: Promise<{ matchId: string }> }) {
  const member = await requireMember();
  const { matchId } = await params;
  const match = await getMatch(matchId);

  // 발표 전 결과는 관리자만 미리 볼 수 있습니다.
  const preview = member.is_admin && match?.status === 'closed';
  if (!match || (match.status !== 'published' && !preview)) notFound();

  const [tally, participation] = await Promise.all([getTally(match.id), getParticipation(match.id)]);

  return (
    <>
      <Header member={member} />
      <main className="stack">
        <div className="page-title">
          <h1>{match.title} 결과</h1>
          <p className="muted">{formatDate(match.match_date)}</p>
        </div>
        {preview && <Notice message="발표 전 미리보기입니다. 팀원들에게는 아직 보이지 않습니다." />}
        <ResultsView tally={tally} participation={participation} />
        <Link href="/" className="small">
          ← 홈으로
        </Link>
      </main>
    </>
  );
}
