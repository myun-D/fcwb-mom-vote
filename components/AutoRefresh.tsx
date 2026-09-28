'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** 화면이 켜져 있는 동안 주기적으로 서버 데이터를 다시 받아옵니다. */
export function AutoRefresh({ intervalMs = 2000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
