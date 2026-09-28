import postgres from 'postgres';

// 개발 모드의 핫 리로드 때마다 연결이 새로 생기지 않도록 전역에 보관합니다.
const globalForSql = globalThis as unknown as { sql?: postgres.Sql };

// Supabase Transaction pooler(6543)는 prepared statement를 지원하지 않아 prepare: false가 필요합니다.
export const sql =
  globalForSql.sql ?? postgres(process.env.DATABASE_URL ?? '', { prepare: false, max: 3 });

if (process.env.NODE_ENV !== 'production') globalForSql.sql = sql;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** submit_ballot 등 DB 함수에서 raise exception으로 던진 안내 메시지인지 확인합니다. */
export function dbUserMessage(err: unknown): string | null {
  if (err && typeof err === 'object' && 'code' in err && err.code === 'P0001' && 'message' in err) {
    return String(err.message);
  }
  return null;
}
