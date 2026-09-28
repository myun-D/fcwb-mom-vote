import { sql } from '@/lib/db';

// Supabase 무료 프로젝트는 7일 동안 사용이 없으면 일시정지됩니다.
// Vercel 예약 작업(vercel.json)이 매일 이 주소를 호출해 DB를 깨워 둡니다.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  await sql`select count(*) from members`;
  return Response.json({ ok: true });
}
