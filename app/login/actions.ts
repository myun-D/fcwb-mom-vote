'use server';

import { redirect } from 'next/navigation';
import { isUuid, sql } from '@/lib/db';
import { PIN_LOCK_MINUTES, PIN_MAX_ATTEMPTS, hashPin, isValidPin, verifyPin } from '@/lib/pin';
import { createSession } from '@/lib/session';

export type LoginState = { error?: string; switchToLogin?: boolean };

/** 두 번째 접속부터: 이름 + PIN으로 로그인 */
export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const memberId = String(formData.get('memberId') ?? '');
  const pin = String(formData.get('pin') ?? '');
  if (!isUuid(memberId)) return { error: '이름을 다시 선택해 주세요.' };
  if (!isValidPin(pin)) return { error: 'PIN은 숫자 4자리입니다.' };

  const [member] = await sql<
    { id: string; pin_hash: string | null; locked_until: Date | null; session_version: number }[]
  >`
    select id, pin_hash, locked_until, session_version
    from members where id = ${memberId} and active
  `;
  if (!member) return { error: '등록된 회원이 아닙니다. 관리자에게 문의해 주세요.' };
  if (!member.pin_hash) return { error: 'PIN이 초기화되었습니다. 이름을 다시 선택해 새 PIN을 만들어 주세요.' };

  if (member.locked_until && member.locked_until.getTime() > Date.now()) {
    const minutes = Math.ceil((member.locked_until.getTime() - Date.now()) / 60000);
    return { error: `PIN을 여러 번 틀려 잠겨 있습니다. ${minutes}분 뒤에 다시 시도해 주세요.` };
  }

  if (!(await verifyPin(pin, member.pin_hash))) {
    const [{ failed_attempts }] = await sql<{ failed_attempts: number }[]>`
      update members set failed_attempts = failed_attempts + 1
      where id = ${member.id} returning failed_attempts
    `;
    if (failed_attempts >= PIN_MAX_ATTEMPTS) {
      await sql`
        update members
        set failed_attempts = 0, locked_until = now() + ${`${PIN_LOCK_MINUTES} minutes`}::interval
        where id = ${member.id}
      `;
      return { error: `PIN을 ${PIN_MAX_ATTEMPTS}번 틀려 ${PIN_LOCK_MINUTES}분 동안 잠겼습니다.` };
    }
    return { error: `PIN이 맞지 않습니다. (${failed_attempts}/${PIN_MAX_ATTEMPTS})` };
  }

  await sql`update members set failed_attempts = 0, locked_until = null where id = ${member.id}`;
  await createSession(member.id, member.session_version);
  redirect('/');
}

/** 처음 접속: 이름을 고르고 PIN을 직접 만듭니다. */
export async function setupPinAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const memberId = String(formData.get('memberId') ?? '');
  const pin = String(formData.get('pin') ?? '');
  const pinConfirm = String(formData.get('pinConfirm') ?? '');
  if (!isUuid(memberId)) return { error: '이름을 다시 선택해 주세요.' };
  if (!isValidPin(pin)) return { error: 'PIN은 숫자 4자리로 만들어 주세요.' };
  if (pin !== pinConfirm) return { error: '두 PIN이 서로 다릅니다. 다시 입력해 주세요.' };

  const pinHash = await hashPin(pin);
  // pin_hash가 비어 있을 때만 설정해서, 동시에 두 사람이 같은 이름을 골라도 한 명만 성공합니다.
  const [member] = await sql<{ id: string; session_version: number }[]>`
    update members
    set pin_hash = ${pinHash}, failed_attempts = 0, locked_until = null
    where id = ${memberId} and active and pin_hash is null
    returning id, session_version
  `;
  if (!member) {
    return { error: '이미 PIN이 설정된 이름입니다. PIN을 입력해 로그인해 주세요.', switchToLogin: true };
  }

  await createSession(member.id, member.session_version);
  redirect('/');
}
