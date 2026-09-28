import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { isUuid, sql } from './db';
import type { Member } from './types';

const COOKIE_NAME = 'mom_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function sign(payload: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET 환경변수(32자 이상)를 설정해 주세요.');
  }
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export async function createSession(memberId: string, sessionVersion: number) {
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const payload = `${memberId}.${sessionVersion}.${expires}`;
  (await cookies()).set(COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE_NAME);
}

function parseSession(value: string): { memberId: string; version: number } | null {
  const [memberId, version, expires, signature] = value.split('.');
  if (!isUuid(memberId) || !version || !expires || !signature) return null;

  const expected = Buffer.from(sign(`${memberId}.${version}.${expires}`));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  if (Number(expires) < Date.now() / 1000) return null;

  return { memberId, version: Number(version) };
}

/** 현재 로그인한 회원. PIN 초기화나 비활성화가 되면 기존 쿠키는 더 이상 통하지 않습니다. */
export const getCurrentMember = cache(async (): Promise<Member | null> => {
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  const session = value ? parseSession(value) : null;
  if (!session) return null;

  const [member] = await sql<Member[]>`
    select id, name, is_admin from members
    where id = ${session.memberId}
      and session_version = ${session.version}
      and active and pin_hash is not null
  `;
  return member ?? null;
});

export async function requireMember(): Promise<Member> {
  const member = await getCurrentMember();
  if (!member) redirect('/login');
  return member;
}

export async function requireAdmin(): Promise<Member> {
  const member = await requireMember();
  if (!member.is_admin) redirect('/');
  return member;
}
