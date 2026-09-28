import Link from 'next/link';
import { Header } from '@/components/Header';
import { Notice } from '@/components/Notice';
import { STATUS_LABEL, formatDate } from '@/lib/format';
import { listMatches } from '@/lib/queries';
import { requireAdmin } from '@/lib/session';
import { AdminNav } from './AdminNav';

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; tone?: 'success' | 'error' }>;
}) {
  const member = await requireAdmin();
  const { msg, tone } = await searchParams;
  const matches = await listMatches();

  return (
    <>
      <Header member={member} />
      <main className="stack">
        <AdminNav current="matches" />
        <Notice message={msg} tone={tone} />

        <Link href="/admin/matches/new" className="btn btn-primary btn-block">
          + 새 경기 만들기
        </Link>

        {matches.length === 0 ? (
          <div className="card">
            <p className="muted" style={{ margin: 0 }}>아직 만든 경기가 없습니다. 위 버튼으로 첫 경기를 만들어 주세요.</p>
          </div>
        ) : (
          <section className="card">
            <ul className="list">
              {matches.map((m) => (
                <li key={m.id}>
                  <Link href={`/admin/matches/${m.id}`} className="row-between" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <span className="stack-sm" style={{ gap: 2 }}>
                      <strong>{m.title}</strong>
                      <span className="muted small">{formatDate(m.match_date)}</span>
                    </span>
                    <span className="row">
                      <span className={`badge badge-${m.status}`}>{STATUS_LABEL[m.status]}</span>
                      <span className="muted" aria-hidden>›</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
