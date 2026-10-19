import Link from 'next/link';
import { Header } from '@/components/Header';
import { Notice } from '@/components/Notice';
import { RealtimeRefresh } from '@/components/RealtimeRefresh';
import { STATUS_LABEL, formatDate, teamClass } from '@/lib/format';
import { getParticipation, getPublishedMoms, hasVoted, isPlayer, listMatches } from '@/lib/queries';
import { MATCHES_TOPIC } from '@/lib/realtime';
import { requireMember } from '@/lib/session';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ voted?: string; msg?: string }>;
}) {
  const member = await requireMember();
  const params = await searchParams;

  const active = await listMatches(['open', 'closed']);
  const [published, moms] = await Promise.all([listMatches(['published']), getPublishedMoms()]);

  const activeCards = await Promise.all(
    active.map(async (match) => ({
      match,
      player: await isPlayer(match.id, member.id),
      voted: await hasVoted(match.id, member.id),
      participation: match.status === 'open' ? await getParticipation(match.id) : null,
    })),
  );

  return (
    <>
      <Header member={member} />
      {/* 투표가 열리거나 마감되고, 누가 투표하면 이 화면이 바로 바뀝니다. */}
      <RealtimeRefresh topic={MATCHES_TOPIC} />
      <main className="stack">
        <div className="page-title">
          <h1>{member.name}님, 안녕하세요</h1>
        </div>

        {params.voted && <Notice tone="success" message="투표를 제출했습니다. 결과는 관리자 발표 뒤에 이 화면에서 볼 수 있어요." />}
        <Notice tone="error" message={params.msg} />

        {activeCards.length === 0 && published.length === 0 && (
          <div className="card">
            <p className="muted" style={{ margin: 0 }}>진행 중인 투표가 없습니다.</p>
          </div>
        )}

        {activeCards.map(({ match, player, voted, participation }) => (
          <section key={match.id} className="card stack">
            <div className="row-between">
              <span className={`badge badge-${match.status}`}>{STATUS_LABEL[match.status]}</span>
              <span className="muted small">{formatDate(match.match_date)}</span>
            </div>
            <h2>{match.title}</h2>
            {participation && participation.eligible > 0 && (
              <div className="stack-sm">
                <div className="row-between">
                  <span className="muted small">투표 참여</span>
                  <strong className="num">
                    {participation.voted}/{participation.eligible}명
                  </strong>
                </div>
                <div
                  className="progress"
                  role="progressbar"
                  aria-valuenow={participation.voted}
                  aria-valuemin={0}
                  aria-valuemax={participation.eligible}
                >
                  <div style={{ width: `${(participation.voted / participation.eligible) * 100}%` }} />
                </div>
              </div>
            )}
            {match.status === 'closed' ? (
              <>
                <p className="muted" style={{ margin: 0 }}>투표가 마감되었습니다. 개표 화면에서 한 표씩 함께 확인해요.</p>
                <Link href={`/live/${match.id}`} className="btn btn-primary btn-block">
                  개표 같이 보기
                </Link>
              </>
            ) : !player ? (
              <p className="muted" style={{ margin: 0 }}>이번 경기 출전 선수만 투표할 수 있습니다.</p>
            ) : voted ? (
              <Notice tone="success" message="투표 완료. 제출한 표는 수정할 수 없습니다." />
            ) : (
              <Link href={`/vote/${match.id}`} className="btn btn-primary btn-block">
                투표하기
              </Link>
            )}
          </section>
        ))}

        {published.length > 0 && (
          <>
            <p className="section-label">경기별 결과</p>
            <section className="card">
              <ul className="list">
                {published.map((match) => (
                  <li key={match.id}>
                    <Link href={`/results/${match.id}`} className="stack-sm" style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div className="row-between">
                        <strong>{match.title}</strong>
                        <span className="muted small">{formatDate(match.match_date)} ›</span>
                      </div>
                      <div className="row" style={{ gap: 16 }}>
                        {moms
                          .filter((m) => m.match_id === match.id)
                          .map((m) => (
                            <span key={m.team_name} className={`team-name ${teamClass(m.sort_order)}`}>
                              {m.name}
                            </span>
                          ))}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
    </>
  );
}
