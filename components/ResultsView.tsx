import { NEUTRAL_LABEL, teamClass } from '@/lib/format';
import type { Participation, TeamTally } from '@/lib/queries';

export function ResultsView({ tally, participation }: { tally: TeamTally[]; participation: Participation }) {
  return (
    <div className="stack">
      <p className="muted small" style={{ margin: 0 }}>
        출전 선수 {participation.eligible}명 중 <span className="num">{participation.voted}</span>명 투표
      </p>
      {tally.map((team) => {
        const mom = team.candidates.find((c) => c.id === team.result?.memberId);
        const others = team.candidates.filter((c) => c.id !== mom?.id);
        const maxVotes = Math.max(1, ...team.candidates.map((c) => c.votes));

        return (
          <section key={team.id} className={`card team-card stack ${teamClass(team.sort_order)}`}>
            <span className="team-name">{team.name} MOM</span>
            {mom ? (
              <>
                <div className="row" style={{ alignItems: 'baseline', gap: 12 }}>
                  <span className="mom-name">{mom.name}</span>
                  {mom.neutral && <span className="tag">{NEUTRAL_LABEL}</span>}
                  <span className="muted num">{mom.votes}표</span>
                </div>
                {team.result?.comment && (
                  <p className="notice notice-info" style={{ margin: 0 }}>
                    <strong>선정 이유 · </strong>
                    {team.result.comment}
                  </p>
                )}
                {mom.reasons.length > 0 && (
                  <>
                    <p className="section-label">팀원들이 남긴 이유</p>
                    <ul className="reasons">
                      {mom.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            ) : (
              <p className="muted">선정된 MOM이 없습니다.</p>
            )}

            {others.some((c) => c.votes > 0) && (
              <>
                <p className="section-label">다른 득표</p>
                <table className="ranking">
                  <tbody>
                    {others
                      .filter((c) => c.votes > 0)
                      .map((c) => (
                        <tr key={c.id}>
                          <td>
                            <details>
                              <summary style={{ color: 'var(--text)' }}>{c.name}</summary>
                              <ul className="reasons">
                                {c.reasons.map((r, i) => (
                                  <li key={i}>{r}</li>
                                ))}
                              </ul>
                            </details>
                            <div className="bar" style={{ width: `${(c.votes / maxVotes) * 100}%` }} />
                          </td>
                          <td style={{ width: 56, verticalAlign: 'top' }}>{c.votes}표</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
