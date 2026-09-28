import type { MatchStatus } from './types';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function formatDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${y}년 ${m}월 ${d}일 (${weekday})`;
}

export const STATUS_LABEL: Record<MatchStatus, string> = {
  draft: '준비 중',
  open: '투표 중',
  closed: '마감 · 선정 중',
  published: '발표 완료',
};

/** 팀 순서(0, 1)에 따라 옐로우/블루 색을 입힙니다. */
export function teamClass(sortOrder: number): string {
  return sortOrder === 0 ? 'team-a' : 'team-b';
}

export const DEFAULT_TEAM_NAMES = ['옐로우', '블루'] as const;
export const NEUTRAL_LABEL = '중립';
