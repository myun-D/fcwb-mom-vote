import { sql } from '@/lib/db';

// Supabase 무료 프로젝트는 7일 동안 사용이 없으면 일시정지됩니다.
// Vercel 예약 작업(vercel.json)이 매일 이 주소를 호출해 DB를 깨워 둡니다.
// CRON_SECRET이 설정돼 있으면 Vercel이 보내는 인증 헤더를 확인하고,
// 설정돼 있지 않아도 동작합니다(개수만 세는 조회라 누가 불러도 무해합니다).
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  const [row] = await sql`select count(*)::int as members from members`;
  return Response.json({ ok: true, members: row.members, at: new Date().toISOString() });
}
