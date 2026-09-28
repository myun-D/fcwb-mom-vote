import Link from 'next/link';

export function AdminNav({ current }: { current: 'matches' | 'members' }) {
  return (
    <div className="row" style={{ gap: 16, paddingTop: 8 }}>
      <Link href="/admin" style={current === 'matches' ? { color: 'var(--text)', fontWeight: 700 } : { textDecoration: 'none' }}>
        경기 관리
      </Link>
      <Link href="/admin/members" style={current === 'members' ? { color: 'var(--text)', fontWeight: 700 } : { textDecoration: 'none' }}>
        회원 관리
      </Link>
    </div>
  );
}
