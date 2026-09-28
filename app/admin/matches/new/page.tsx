import Link from 'next/link';
import { createMatchAction } from '@/app/admin/actions';
import { Header } from '@/components/Header';
import { Notice } from '@/components/Notice';
import { SubmitButton } from '@/components/SubmitButton';
import { DEFAULT_TEAM_NAMES } from '@/lib/format';
import { requireAdmin } from '@/lib/session';

function koreaNow(): Date {
  return new Date(Date.now() + 9 * 3600 * 1000);
}

function defaultTitle(): string {
  const now = koreaNow();
  return `${now.getUTCFullYear()}년 ${now.getUTCMonth() + 1}월 정기전`;
}

function today(): string {
  return koreaNow().toISOString().slice(0, 10);
}

export default async function NewMatchPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; tone?: 'success' | 'error' }>;
}) {
  const member = await requireAdmin();
  const { msg, tone } = await searchParams;

  return (
    <>
      <Header member={member} />
      <main className="stack">
        <div className="page-title stack-sm">
          <Link href="/admin" className="small">← 경기 목록</Link>
          <h1>새 경기 만들기</h1>
          <p className="muted" style={{ margin: 0 }}>만든 뒤 다음 화면에서 출전 명단을 편성합니다.</p>
        </div>
        <Notice message={msg} tone={tone} />

        <form action={createMatchAction} className="stack">
          <section className="card stack">
            <label className="field">
              경기 이름
              <input id="new-title" type="text" name="title" defaultValue={defaultTitle()} required maxLength={50} />
            </label>
            <label className="field">
              경기 날짜
              <input id="new-date" type="date" name="date" defaultValue={today()} required />
            </label>
            <div className="grid-2">
              <label className="field">
                첫 번째 팀
                <input id="new-team-a" type="text" name="teamA" defaultValue={DEFAULT_TEAM_NAMES[0]} required maxLength={20} />
              </label>
              <label className="field">
                두 번째 팀
                <input id="new-team-b" type="text" name="teamB" defaultValue={DEFAULT_TEAM_NAMES[1]} required maxLength={20} />
              </label>
            </div>
          </section>
          <SubmitButton className="btn btn-primary btn-block">만들고 명단 편성하기</SubmitButton>
        </form>
      </main>
    </>
  );
}
