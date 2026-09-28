'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { dbUserMessage, isUuid, sql } from '@/lib/db';
import { getCurrentMember } from '@/lib/session';

export type VoteState = { error?: string };

export async function submitBallotAction(_prev: VoteState, formData: FormData): Promise<VoteState> {
  const member = await getCurrentMember();
  if (!member) return { error: '로그인이 풀렸습니다. 다시 로그인해 주세요.' };

  const matchId = String(formData.get('matchId') ?? '');
  const teamIds = formData.getAll('teamId').map(String);
  if (!isUuid(matchId) || teamIds.length === 0 || !teamIds.every(isUuid)) {
    return { error: '잘못된 요청입니다. 새로고침 뒤 다시 시도해 주세요.' };
  }

  const votes = teamIds.map((teamId) => ({
    team_id: teamId,
    candidate_id: String(formData.get(`candidate_${teamId}`) ?? ''),
    reason: String(formData.get(`reason_${teamId}`) ?? '').trim(),
  }));
  if (!votes.every((v) => isUuid(v.candidate_id))) return { error: '모든 팀의 MOM을 선택해 주세요.' };

  try {
    await sql`select submit_ballot(${matchId}, ${member.id}, ${sql.json(votes)})`;
  } catch (err) {
    const message = dbUserMessage(err);
    if (message) return { error: message };
    console.error(err);
    return { error: '제출하지 못했습니다. 잠시 뒤 다시 시도해 주세요.' };
  }

  revalidatePath('/');
  redirect('/?voted=1');
}
