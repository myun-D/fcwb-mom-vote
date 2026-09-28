'use client';

import { useActionState, useState } from 'react';
import { Notice } from '@/components/Notice';
import { SubmitButton } from '@/components/SubmitButton';
import { NEUTRAL_LABEL, teamClass } from '@/lib/format';
import type { TeamWithPlayers } from '@/lib/types';
import { type VoteState, submitBallotAction } from './actions';

type VoteTeam = TeamWithPlayers & { isMine: boolean };

const REASON_MIN = 5;
const REASON_MAX = 300;

export function VoteForm({ matchId, teams }: { matchId: string; teams: VoteTeam[] }) {
  const [state, action] = useActionState<VoteState, FormData>(submitBallotAction, {});
  const [step, setStep] = useState<'fill' | 'confirm'>('fill');
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const reasonLength = (teamId: string) => (reasons[teamId] ?? '').trim().length;
  const isDone = (teamId: string) => Boolean(picks[teamId]) && reasonLength(teamId) >= REASON_MIN;
  const doneCount = teams.filter((t) => isDone(t.id)).length;
  const complete = doneCount === teams.length;
  const nameOf = (team: VoteTeam) => team.players.find((p) => p.id === picks[team.id])?.name;

  const goTo = (next: 'fill' | 'confirm') => {
    setStep(next);
    window.scrollTo({ top: 0 });
  };

  return (
    <form action={action} className="stack">
      <input type="hidden" name="matchId" value={matchId} />

      {/* 확인 단계에서도 입력값이 함께 제출되도록 숨기기만 합니다. */}
      <div className="stack" hidden={step !== 'fill'}>
        <p className="notice notice-info">
          팀마다 <strong>MOM 한 명</strong>을 고르고 <strong>이유</strong>를 적어 주세요. 투표는 익명이라 누가 누구를 뽑았는지
          아무도 알 수 없습니다.
        </p>

        {teams.map((team, i) => {
          const done = isDone(team.id);
          const length = reasonLength(team.id);
          return (
            <fieldset key={team.id} className={`card team-card stack ${teamClass(team.sort_order)}`} style={{ margin: 0 }}>
              <input type="hidden" name="teamId" value={team.id} />
              <legend className="sr-only">{team.name} MOM</legend>
              <div className="row-between">
                <div className="row">
                  <h2 className="team-name">{team.name} MOM</h2>
                  {team.isMine && <span className="tag">내 팀</span>}
                </div>
                <span className={`step-count${done ? ' is-done' : ''}`}>
                  {done ? '✓ 완료' : `${i + 1} / ${teams.length}`}
                </span>
              </div>

              <div className="choice-grid" role="radiogroup" aria-label={`${team.name} MOM 선택`}>
                {team.players.map((p) => (
                  <label key={p.id} className="choice">
                    <input
                      type="radio"
                      name={`candidate_${team.id}`}
                      value={p.id}
                      checked={picks[team.id] === p.id}
                      onChange={() => setPicks({ ...picks, [team.id]: p.id })}
                    />
                    <span>
                      {p.name}
                      {p.neutral && <small className="choice-sub">{NEUTRAL_LABEL}</small>}
                    </span>
                  </label>
                ))}
              </div>

              <label className="field">
                {nameOf(team) ? `${nameOf(team)} 선수를 뽑은 이유` : '뽑은 이유'}
                <textarea
                  id={`reason-${team.id}`}
                  name={`reason_${team.id}`}
                  placeholder="예: 후반에 결정적인 수비를 두 번 해냈어요"
                  maxLength={REASON_MAX}
                  value={reasons[team.id] ?? ''}
                  onChange={(e) => setReasons({ ...reasons, [team.id]: e.target.value })}
                />
                <span className="field-hint num">
                  {length < REASON_MIN ? `${REASON_MIN - length}자 더 적어 주세요` : `${length}/${REASON_MAX}자`}
                </span>
              </label>
            </fieldset>
          );
        })}

        <div className="action-bar stack-sm">
          <button type="button" className="btn btn-primary btn-block" disabled={!complete} onClick={() => goTo('confirm')}>
            {complete ? '다음: 확인하기' : `${teams.length}팀 중 ${doneCount}팀 완료`}
          </button>
        </div>
      </div>

      {step === 'confirm' && (
        <div className="stack">
          <div className="card stack">
            <h2>이대로 제출할까요?</h2>
            {teams.map((team) => (
              <div key={team.id} className={`stack-sm ${teamClass(team.sort_order)}`}>
                <div className="row-between">
                  <span className="team-name">{team.name}</span>
                  <strong>{nameOf(team)}</strong>
                </div>
                <p className="quote">{reasons[team.id]?.trim()}</p>
              </div>
            ))}
          </div>
          <Notice message="제출한 뒤에는 수정할 수 없습니다." />
          <Notice tone="error" message={state.error} />
          <div className="action-bar stack-sm">
            <SubmitButton className="btn btn-primary btn-block" pendingText="제출 중…">
              제출하기
            </SubmitButton>
            <button type="button" className="btn btn-secondary btn-block" onClick={() => goTo('fill')}>
              다시 고치기
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
