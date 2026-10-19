'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useRealtime } from '@/lib/useRealtime';

// 실시간 연결이 안 될 때의 확인 간격과, 연결됐을 때 혹시 놓친 신호를 보완하는 확인 간격
const POLL_MS = 5000;
const FALLBACK_POLL_MS = 30000;

/** 실시간 신호가 오면 서버 화면을 다시 받아옵니다. 화면에는 아무것도 그리지 않습니다. */
export function RealtimeRefresh({ topic }: { topic: string }) {
  const router = useRouter();
  const pollMs = useRef(POLL_MS);
  const lastRefresh = useRef(Date.now());
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // 여러 사람이 거의 동시에 투표해도 한 번만 새로고침하도록 잠깐 모았다가 갱신합니다.
  const refresh = () => {
    if (pending.current) return;
    pending.current = setTimeout(() => {
      pending.current = undefined;
      lastRefresh.current = Date.now();
      router.refresh();
    }, 300);
  };

  useRealtime(topic, refresh, (connected) => {
    pollMs.current = connected ? FALLBACK_POLL_MS : POLL_MS;
  });

  // 신호를 놓쳤을 때를 대비한 주기적 확인, 그리고 화면을 다시 켰을 때 바로 갱신
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden && Date.now() - lastRefresh.current >= pollMs.current) refresh();
    }, 1000);
    const onVisible = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      clearTimeout(pending.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // refresh는 router와 ref만 사용하므로 한 번만 등록하면 됩니다.
  }, []);

  return null;
}
