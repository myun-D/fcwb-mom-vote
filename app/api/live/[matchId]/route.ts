import { getMatch, getReveal } from '@/lib/queries';
import { getCurrentMember } from '@/lib/session';

// 개표 화면이 2초마다 가져가는 현재 개표 상태. 공개된 표만 들어 있습니다.
export async function GET(_request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const noStore = { 'Cache-Control': 'no-store' };
  if (!(await getCurrentMember())) return Response.json({ error: 'unauthorized' }, { status: 401, headers: noStore });

  const { matchId } = await params;
  const match = await getMatch(matchId);
  if (!match) return Response.json({ error: 'not found' }, { status: 404, headers: noStore });

  const reveal = match.status === 'closed' ? await getReveal(match.id) : null;
  return Response.json({ status: match.status, reveal }, { headers: noStore });
}
