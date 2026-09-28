import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { AutoRefresh } from '@/components/AutoRefresh';
import { Header } from '@/components/Header';
import { teamClass } from '@/lib/format';
import { getMatch, getReveal } from '@/lib/queries';
import { requireMember } from '@/lib/session';
import { RevealControls } from './RevealControls';

export default async function LivePage({ params }: { params: Promise<{ matchId: string }> }) {
  const member = await requireMember();
  const { matchId } = await params;
  const match = await getMatch(matchId);
  if (!match) notFound();
  if (match.status === 'published') redirect(`/results/${match.id}`);
  if (match.status !== 'closed') redirect('/?msg=' + encodeURIComponent('투표가 마감된 뒤에 개표를 볼 수 있습니다.'));

  const reveal = await getReveal(match.id);
  const { current, pos, total } = reveal;
  const currentTeam = reveal.teams.find((t) => t.id === current?.team_id);
  const finished = reveal.started && total > 0 && pos >= total;

  return (
    <>
      <Header member={member} />
      <AutoRefresh />
      <main className="stack">
        <div className="page-title stack-sm">
          <h1>{match.title} 개표</h1>
          {reveal.started && total > 0 && (
            <>
              <div className="row-between">
                <span className="muted small">한 표씩 함께 확인합니다</span>
                <strong className="num">{pos} / {total}표</strong>
              </div>
              <div className="progress" role="progressbar" aria-valuenow={pos} aria-valuemin={0} aria-valuemax={total}>
                <div style={{ width: `${(pos / total) * 100}%` }} />
              </div>
            </>
          )}
        </div>

        {!reveal.started ? (
          <section className="card reveal-card reveal-waiting">
            <p className="reveal-name">잠시만요</p>
            <p className="muted" style={{ margin: 0 }}>
              {member.is_admin
                ? '아래 개표 시작을 누르면 모두의 화면에 한 표씩 나타납니다.'
                : '관리자가 개표를 시작하면 이 화면에 한 표씩 나타납니다. 화면을 켜 두세요.'}
            </p>
          </section>
        ) : total === 0 ? (
          <section className="card reveal-card reveal-waiting">
            <p className="muted" style={{ margin: 0 }}>들어온 표가 없습니다.</p>
          </section>
        ) : current && currentTeam ? (
          // key가 바뀔 때마다 새 카드로 등장 효과가 다시 재생됩니다.
          <section key={current.id} className={`card team-card reveal-card ${teamClass(currentTeam.sort_order)}`} aria-live="polite">
            <div className="row-between">
              <span className="team-name">{currentTeam.name} MOM</span>
              <span className="muted small num">
                {current.indexInTeam} / {currentTeam.total}번째 표
              </span>
            </div>
            <p className="reveal-name">{current.name}</p>
            {current.reason ? (
              <p className="reveal-reason">“{current.reason}”</p>
            ) : (
              <p className="reveal-reason muted">이유 없음</p>
            )}
          </section>
        ) : (
          <section className="card reveal-card reveal-waiting">
            <p className="reveal-name">개표 준비 완료</p>
            <p className="muted" style={{ margin: 0 }}>첫 표를 기다리고 있어요.</p>
          </section>
        )}

        {finished && (
          <p className="notice notice-success">
            개표가 끝났습니다! 관리자가 팀별 MOM을 확정해서 발표합니다.
          </p>
        )}

        {reveal.started && total > 0 && (
          <div className="grid-2">
            {reveal.teams.map((team) => (
              <section key={team.id} className={`card team-card stack-sm ${teamClass(team.sort_order)}`}>
                <div className="row-between">
                  <span className="team-name">{team.name}</span>
                  <span className="muted small num">{team.revealed} / {team.total}표</span>
                </div>
                {team.tally.length === 0 ? (
                  <p className="muted small" style={{ margin: 0 }}>아직 공개된 표가 없습니다.</p>
                ) : (
                  <table className="ranking">
                    <tbody>
                      {team.tally.map((c) => (
                        <tr key={c.name}>
                          <td>
                            {c.name}
                            <div className="bar" style={{ width: `${(c.votes / team.tally[0].votes) * 100}%` }} />
                          </td>
                          <td style={{ width: 48, verticalAlign: 'top' }}>{c.votes}표</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            ))}
          </div>
        )}

        {member.is_admin && (
          <>
            {finished && (
              <Link href={`/admin/matches/${match.id}`} className="btn btn-secondary btn-block">
                MOM 선정하러 가기 →
              </Link>
            )}
            <RevealControls matchId={match.id} started={reveal.started} pos={pos} total={total} />
          </>
        )}
      </main>
    </>
  );
}
