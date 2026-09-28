'use client';

import { useState } from 'react';
import { NEUTRAL_LABEL, teamClass } from '@/lib/format';
import type { Player, Team } from '@/lib/types';

/** '' = 미출전, 'neutral' = 두 팀 모두, 그 외 = 팀 id */
export type RosterChoice = string;

type Props = {
  members: Player[];
  teams: Team[];
  initial: Record<string, RosterChoice>;
};

export function RosterEditor({ members, teams, initial }: Props) {
  const [choices, setChoices] = useState<Record<string, RosterChoice>>(initial);
  const [query, setQuery] = useState('');

  const values = members.map((m) => choices[m.id] ?? '');
  const neutral = values.filter((v) => v === 'neutral').length;
  const absent = values.filter((v) => v === '').length;
  // 중립 선수는 모든 팀 명단에 함께 들어갑니다.
  const teamMembers = (teamId: string) => members.filter((m) => [teamId, 'neutral'].includes(choices[m.id] ?? ''));
  const q = query.trim();

  return (
    <div className="stack">
      <div className="roster-summary" aria-live="polite">
        {teams.map((t) => {
          const list = teamMembers(t.id);
          return (
            <div key={t.id} className={`roster-count ${teamClass(t.sort_order)}`}>
              <div className="row-between">
                <span className="team-name">{t.name}</span>
                <strong className="num">{list.length}명</strong>
              </div>
              {list.length > 0 && (
                <p className="roster-names">
                  {list.map((m) => (
                    <span key={m.id}>
                      {m.name}
                      {choices[m.id] === 'neutral' && <span className="tag">{NEUTRAL_LABEL}</span>}
                    </span>
                  ))}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        인원이 홀수라 두 팀 모두에서 뛴 사람은 <strong>{NEUTRAL_LABEL}</strong>으로 두세요. 모든 팀 명단에 이름이 들어가고, 어느
        팀에서든 MOM 후보가 됩니다.{neutral > 0 && ` (중립 ${neutral}명)`} 미출전 {absent}명은 투표할 수 없습니다.
      </p>

      {members.length > 10 && (
        <input
          id="roster-search"
          type="search"
          placeholder="이름 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="명단에서 이름 검색"
        />
      )}

      <div className="roster">
        {members.map((m) => {
          const name = `player_${m.id}`;
          const current = choices[m.id] ?? '';
          const set = (value: RosterChoice) => setChoices((prev) => ({ ...prev, [m.id]: value }));
          return (
            // 검색으로 가려진 줄도 선택값은 함께 저장되도록 숨기기만 합니다.
            <div key={m.id} className="roster-row" hidden={q !== '' && !m.name.includes(q)}>
              <span className="roster-name">{m.name}</span>
              <div className="segmented" role="radiogroup" aria-label={`${m.name} 소속`}>
                <label>
                  <input type="radio" name={name} value="" checked={current === ''} onChange={() => set('')} />
                  <span>미출전</span>
                </label>
                {teams.map((t) => (
                  <label key={t.id} className={teamClass(t.sort_order)}>
                    <input type="radio" name={name} value={t.id} checked={current === t.id} onChange={() => set(t.id)} />
                    <span>{t.name}</span>
                  </label>
                ))}
                <label className="team-n">
                  <input type="radio" name={name} value="neutral" checked={current === 'neutral'} onChange={() => set('neutral')} />
                  <span>{NEUTRAL_LABEL}</span>
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
