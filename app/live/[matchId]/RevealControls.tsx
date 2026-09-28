'use client';

import { useEffect, useTransition } from 'react';
import { startRevealAction, stepRevealAction } from './actions';

type Props = { matchId: string; started: boolean; pos: number; total: number };

/** 관리자 전용 개표 조작 버튼. 노트북이면 ← → 방향키나 스페이스바로도 넘길 수 있습니다. */
export function RevealControls({ matchId, started, pos, total }: Props) {
  const [pending, startTransition] = useTransition();
  const step = (delta: 1 | -1) => startTransition(() => stepRevealAction(matchId, delta));
  const restart = () => startTransition(() => startRevealAction(matchId));

  useEffect(() => {
    if (!started) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, button')) return;
      if ((e.key === 'ArrowRight' || e.key === ' ') && pos < total) {
        e.preventDefault();
        startTransition(() => stepRevealAction(matchId, 1));
      } else if (e.key === 'ArrowLeft' && pos > 0) {
        e.preventDefault();
        startTransition(() => stepRevealAction(matchId, -1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [matchId, started, pos, total]);

  if (!started) {
    return (
      <div className="action-bar">
        <button type="button" className="btn btn-primary btn-block" disabled={pending} onClick={restart}>
          {pending ? '준비 중…' : '개표 시작'}
        </button>
      </div>
    );
  }

  return (
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
  );
}
