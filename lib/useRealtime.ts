'use client';

import { useEffect, useRef } from 'react';

/**
 * Supabase Realtime 채널을 구독해서 신호가 올 때마다 onSignal을 부릅니다.
 * onStatus에는 연결 여부가 전달되어, 연결이 안 될 때 더 자주 확인하는 데 씁니다.
 * 환경변수가 없으면 아무것도 하지 않습니다(연결 안 됨으로 남음).
 */
export function useRealtime(topic: string, onSignal: () => void, onStatus?: (connected: boolean) => void) {
  // 콜백이 바뀌어도 다시 구독하지 않도록 최신 콜백을 ref에 둡니다.
  const signalRef = useRef(onSignal);
  const statusRef = useRef(onStatus);
  signalRef.current = onSignal;
  statusRef.current = onStatus;

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    let stopped = false;
    let wasConnected = false;
    let cleanup = () => {};
    void import('@supabase/supabase-js').then(({ createClient }) => {
      if (stopped) return;
      const supabase = createClient(url, key, { auth: { persistSession: false } });
      const channel = supabase
        .channel(topic)
        .on('broadcast', { event: 'changed' }, () => signalRef.current())
        .subscribe((status) => {
          const connected = status === 'SUBSCRIBED';
          statusRef.current?.(connected);
          // 끊겼다가 다시 연결됐을 때 그사이 놓친 변경을 바로 반영합니다.
          if (connected && wasConnected) signalRef.current();
          if (connected) wasConnected = true;
        });
      cleanup = () => void supabase.removeChannel(channel);
    });
    return () => {
      stopped = true;
      cleanup();
    };
  }, [topic]);
}
