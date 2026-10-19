// 화면 실시간 갱신 (Supabase Realtime Broadcast)
// 서버에서 무언가 바뀌면 "바뀌었다"는 신호만 보내고, 각 화면은 신호를 받는 즉시 서버에서 다시 가져옵니다.
// 신호에는 내용이 없어서 공개 전 표 같은 정보가 새어 나갈 것이 없습니다.

/** 경기 하나의 변화(투표 참여, 개표 진행, 상태 변경)를 듣는 채널 */
export const matchTopic = (matchId: string) => `match-${matchId}`;
/** 경기 목록(홈 화면)에 보이는 변화(투표 열림·마감·발표, 참여 인원)를 듣는 채널 */
export const MATCHES_TOPIC = 'matches';

/**
 * 화면들에 경기가 바뀌었다고 알립니다. listChanged면 홈 화면들에도 알립니다.
 * 실패해도 화면은 주기적 확인으로 따라오므로 무시합니다.
 */
export async function notifyMatch(matchId: string, listChanged = false): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return;
  const topics = listChanged ? [matchTopic(matchId), MATCHES_TOPIC] : [matchTopic(matchId)];
  // 예전 anon 키(eyJ…)는 Authorization에도 넣고, 새 publishable 키(sb_publishable_…)는 apikey로만 보냅니다.
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ messages: topics.map((topic) => ({ topic, event: 'changed', payload: {} })) }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // 알림이 실패해도 원래 작업에는 영향이 없습니다.
  }
}
