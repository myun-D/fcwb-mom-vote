'use client';

import { useActionState, useEffect, useState } from 'react';
import { Notice } from '@/components/Notice';
import { SubmitButton } from '@/components/SubmitButton';
import { type LoginState, loginAction, setupPinAction } from './actions';

type LoginMember = { id: string; name: string; hasPin: boolean };

export function LoginForm({ members }: { members: LoginMember[] }) {
  const [selected, setSelected] = useState<LoginMember | null>(null);
  const [query, setQuery] = useState('');

  if (!selected) {
    const filtered = members.filter((m) => m.name.includes(query.trim()));
    return (
      <div className="stack">
        {members.length > 8 && (
          <input
            id="name-search"
            type="search"
            placeholder="이름 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="이름 검색"
          />
        )}
        {members.length === 0 ? (
          <Notice message="등록된 회원이 없습니다. 관리자에게 문의해 주세요." />
        ) : (
          <div className="name-grid">
            {filtered.map((m) => (
              <button key={m.id} type="button" onClick={() => setSelected(m)}>
                {m.name}
              </button>
            ))}
          </div>
        )}
        <p className="muted small">이름이 없으면 관리자에게 등록을 요청해 주세요.</p>
      </div>
    );
  }

  return <PinStep key={selected.id} member={selected} onBack={() => setSelected(null)} />;
}

function PinStep({ member, onBack }: { member: LoginMember; onBack: () => void }) {
  const [mode, setMode] = useState<'login' | 'setup'>(member.hasPin ? 'login' : 'setup');
  const [loginState, login] = useActionState<LoginState, FormData>(loginAction, {});
  const [setupState, setup] = useActionState<LoginState, FormData>(setupPinAction, {});

  useEffect(() => {
    if (setupState.switchToLogin) setMode('login');
  }, [setupState]);

  const pinProps = {
    type: 'password',
    inputMode: 'numeric',
    pattern: '[0-9]{4}',
    maxLength: 4,
    autoComplete: 'off',
    required: true,
    className: 'pin-input',
  } as const;

  return (
    <div className="card stack">
      <div className="row-between">
        <h2>{member.name}</h2>
        <button type="button" className="link-button small" onClick={onBack}>
          다른 이름 선택
        </button>
      </div>

      {mode === 'setup' ? (
        <form action={setup} className="stack">
          <Notice message="처음 오셨네요. 앞으로 사용할 PIN 4자리를 만들어 주세요." />
          <input type="hidden" name="memberId" value={member.id} />
          <label className="field">
            PIN 4자리
            <input id="pin-new" name="pin" autoFocus {...pinProps} />
          </label>
          <label className="field">
            PIN 한 번 더 입력
            <input id="pin-confirm" name="pinConfirm" {...pinProps} />
          </label>
          <Notice message={setupState.error} tone="error" />
          <SubmitButton className="btn btn-primary btn-block">PIN 만들고 시작하기</SubmitButton>
          <p className="muted small">PIN은 다음 경기에도 계속 사용합니다. 잊어버리면 관리자에게 초기화를 요청해 주세요.</p>
        </form>
      ) : (
        <form action={login} className="stack">
          <Notice message={setupState.switchToLogin ? setupState.error : undefined} />
          <input type="hidden" name="memberId" value={member.id} />
          <label className="field">
            PIN
            <input id="pin" name="pin" autoFocus {...pinProps} />
          </label>
          <Notice message={loginState.error} tone="error" />
          <SubmitButton className="btn btn-primary btn-block">로그인</SubmitButton>
        </form>
      )}
    </div>
  );
}
