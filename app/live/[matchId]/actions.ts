'use server';

import { isUuid, sql } from '@/lib/db';
import { type RevealState, getReveal } from '@/lib/queries';
import { requireAdmin } from '@/lib/session';

// 화면 전체를 새로고침하지 않고, 바뀐 개표 상태를 바로 돌려줘서 관리자 화면이 즉시 바뀌게 합니다.

/** 개표를 (다시) 시작합니다. 팀 순서대로, 팀 안에서는 표를 무작위로 섞어 순서를 고정합니다. */
export async function startRevealAction(matchId: string): Promise<RevealState | null> {
  await requireAdmin();
  if (!isUuid(matchId)) return null;
  await sql`
    update matches
    set reveal_pos = 0,
        reveal_order = coalesce((
          select array_agg(v.id order by t.sort_order, random())
          from votes v join teams t on t.id = v.team_id
          where v.match_id = ${matchId}
        ), '{}')
    where id = ${matchId} and status = 'closed'
  `;
  return getReveal(matchId);
}

/** 한 표 앞으로(1) 또는 뒤로(-1) 넘깁니다. */
export async function stepRevealAction(matchId: string, delta: number): Promise<RevealState | null> {
  await requireAdmin();
  if (!isUuid(matchId) || (delta !== 1 && delta !== -1)) return null;
  await sql`
    update matches
    set reveal_pos = least(greatest(reveal_pos + ${delta}, 0), cardinality(reveal_order))
    where id = ${matchId} and status = 'closed' and reveal_order is not null
  `;
  return getReveal(matchId);
}
