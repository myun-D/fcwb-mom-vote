import Image from 'next/image';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { getCurrentMember } from '@/lib/session';
import { LoginForm } from './LoginForm';

export default async function LoginPage() {
  if (await getCurrentMember()) redirect('/');

  const members = await sql<{ id: string; name: string; has_pin: boolean }[]>`
    select id, name, (pin_hash is not null) as has_pin
    from members where active order by name
  `;

  return (
    <main className="stack">
      <div className="login-hero">
        <Image src="/logo.png" alt="White Bears" width={240} height={116} priority />
        <h1>MOM 투표</h1>
        <p className="muted">본인 이름을 선택해 주세요.</p>
      </div>
      <LoginForm members={members.map((m) => ({ id: m.id, name: m.name, hasPin: m.has_pin }))} />
    </main>
  );
}
