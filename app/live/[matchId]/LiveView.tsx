'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { teamClass } from '@/lib/format';
import type { RevealState } from '@/lib/queries';
import { startRevealAction, stepRevealAction } from './actions';

const POLL_MS = 2000;

type Props = { matchId: string; isAdmin: boolean; initial: RevealState };

export function LiveView({ matchId, isAdmin, initial }: Props) {
  const [state, setState] = useState(initial);
  const [pending, startTransition] = useTransition();
  // 관리자가 넘긴 직후 도착한 예전 폴링 응답이 화면을 되돌리지 않도록 순번을 둡니다.
  const version = useRef(0);

  // 이전 요청이 끝난 뒤에만 다음 요청을 보내서 요청이 겹치지 않게 합니다.
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const started = version.current;
      try {
        if (!document.hidden) {
          const res = await fetch(`/api/live/${matchId}`, { cache: 'no-store' });
          if (res.ok) {
            const data: { status: string; reveal: RevealState | null } = await res.json();
            if (data.status === 'published') return void window.location.assign(`/results/${matchId}`);
            if (data.status !== 'closed' || !data.reveal) return void window.location.assign('/');
            if (!stopped && version.current === started) setState(data.reveal);
          }
        }
      } catch {
        // 네트워크가 잠깐 끊겨도 다음 주기에 다시 시도합니다.
      }
      if (!stopped) timer = setTimeout(poll, POLL_MS);
    };
    timer = setTimeout(poll, POLL_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [matchId]);

  const run = (action: () => Promise<RevealState | null>) =>
    startTransition(async () => {
      version.current += 1;
      const next = await action();
      if (next) setState(next);
    });
  const step = (delta: 1 | -1) => run(() => stepRevealAction(matchId, delta));
  const restart = () => run(() => startRevealAction(matchId));

  const { current, pos, total, started } = state;
  const currentTeam = state.teams.find((t) => t.id === current?.team_id);
  const finished = started && total > 0 && pos >= total;

  // 노트북에 띄웠을 때 → 방향키나 스페이스바로 다음 표, ← 로 이전 표
  const keyState = useRef({ pos, total, started, pending });
  keyState.current = { pos, total, started, pending };
  useEffect(() => {
    if (!isAdmin) return;
    const onKey = (e: KeyboardEvent) => {
      const s = keyState.current;
      if (!s.started || s.pending) return;
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, button')) return;
      if ((e.key === 'ArrowRight' || e.key === ' ') && s.pos < s.total) {
        e.preventDefault();
        step(1);
      } else if (e.key === 'ArrowLeft' && s.pos > 0) {
        e.preventDefault();
        step(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // step은 matchId만 사용하므로 matchId가 같으면 다시 등록할 필요가 없습니다.
  }, [isAdmin, matchId]);

  return (
    <>
      {started && total > 0 && (
        <div className="stack-sm">
          <div className="row-between">
            <span className="muted small">한 표씩 함께 확인합니다</span>
            <strong className="num">
              {pos} / {total}표
            </strong>
          </div>
          <div className="progress" role="progressbar" aria-valuenow={pos} aria-valuemin={0} aria-valuemax={total}>
            <div style={{ width: `${(pos / total) * 100}%` }} />
          </div>
        </div>
      )}

      {!started ? (
        <section className="card reveal-card reveal-waiting">
          <p className="reveal-name">잠시만요</p>
          <p className="muted" style={{ margin: 0 }}>
            {isAdmin
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

      {finished && <p className="notice notice-success">개표가 끝났습니다! 관리자가 팀별 MOM을 확정해서 발표합니다.</p>}

      {started && total > 0 && (
        <div className="grid-2">
          {state.teams.map((team) => (
            <section key={team.id} className={`card team-card stack-sm ${teamClass(team.sort_order)}`}>
              <div className="row-between">
                <span className="team-name">{team.name}</span>
                <span className="muted small num">
                  {team.revealed} / {team.total}표
                </span>
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

      {isAdmin && (
        <>
          {finished && (
            <Link href={`/admin/matches/${matchId}`} className="btn btn-secondary btn-block">
              MOM 선정하러 가기 →
            </Link>
          )}
          {!started ? (
            <div className="action-bar">
              <button type="button" className="btn btn-primary btn-block" disabled={pending} onClick={restart}>
                {pending ? '준비 중…' : '개표 시작'}
              </button>
            </div>
          ) : (
            <div className="action-bar stack-sm">
              <div className="grid-2 reveal-buttons">
                <button type="button" className="btn btn-secondary" disabled={pending || pos === 0} onClick={() => step(-1)}>
                  ← 이전
                </button>
                <button type="button" className="btn btn-primary" disabled={pending || pos >= total} onClick={() => step(1)}>
                  {pos === 0 ? '첫 표 공개 →' : '다음 표 →'}
                </button>
              </div>
              <button
                type="button"
                className="link-button small"
                style={{ alignSelf: 'center' }}
                disabled={pending}
                onClick={() => {
                  if (window.confirm('처음부터 다시 개표할까요? 표 순서도 새로 섞입니다.')) restart();
                }}
              >
                처음부터 다시
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
