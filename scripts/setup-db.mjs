// DB 테이블을 만들고 첫 관리자를 등록합니다.
// 사용법: npm run db:setup -- "관리자 이름"
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL이 없습니다. .env.local 파일을 먼저 만들어 주세요.');
  process.exit(1);
}

const adminName = process.argv[2]?.trim();
const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });

try {
  const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
  await sql.unsafe(schema);
  console.log('테이블 생성 완료');

  if (adminName) {
    await sql`
      insert into members (name, is_admin) values (${adminName}, true)
      on conflict (name) do update set is_admin = true, active = true
    `;
    console.log(`관리자 등록 완료: ${adminName}`);
    console.log('앱에 접속해 이 이름으로 먼저 로그인하고 PIN을 설정해 주세요.');
  } else {
    console.log('관리자를 등록하려면: npm run db:setup -- "관리자 이름"');
  }
} catch (err) {
  console.error('실패:', err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
