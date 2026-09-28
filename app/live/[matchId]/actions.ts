'use server';

import { refresh } from 'next/cache';
import { isUuid, sql } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

/** 개표를 (다시) 시작합니다. 팀 순서대로, 팀 안에서는 표를 무작위로 섞어 순서를 고정합니다. */
export async function startRevealAction(matchId: string) {
  await requireAdmin();
  if (!isUuid(matchId)) return;
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
  refresh();
}

/** 한 표 앞으로(1) 또는 뒤로(-1) 넘깁니다. */
export async function stepRevealAction(matchId: string, delta: number) {
  await requireAdmin();
  if (!isUuid(matchId) || (delta !== 1 && delta !== -1)) return;
  await sql`
    update matches
    set reveal_pos = least(greatest(reveal_pos + ${delta}, 0), cardinality(reveal_order))
    where id = ${matchId} and status = 'closed' and reveal_order is not null
  `;
  refresh();
}
