import Image from 'next/image';
import Link from 'next/link';
import { logoutAction } from '@/app/actions';
import type { Member } from '@/lib/types';

export function Header({ member }: { member: Member }) {
  return (
    <header className="site-header">
      <Link href="/" className="brand" aria-label="홈으로">
        <Image src="/logo.png" alt="White Bears" width={83} height={40} priority />
        <span>MOM 투표</span>
      </Link>
      <nav className="nav">
        {member.is_admin && <Link href="/admin">관리</Link>}
        <form action={logoutAction}>
          <button type="submit" className="link-button">
            로그아웃
          </button>
        </form>
      </nav>
    </header>
  );
}
