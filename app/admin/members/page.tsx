import { AdminNav } from '@/app/admin/AdminNav';
import { addMembersAction, resetPinAction, toggleActiveAction, toggleAdminAction } from '@/app/admin/actions';
import { Header } from '@/components/Header';
import { Notice } from '@/components/Notice';
import { SubmitButton } from '@/components/SubmitButton';
import { sql } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

type Row = { id: string; name: string; is_admin: boolean; active: boolean; has_pin: boolean; locked: boolean };

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; tone?: 'success' | 'error' }>;
}) {
  const me = await requireAdmin();
  const { msg, tone } = await searchParams;
  const members = await sql<Row[]>`
    select id, name, is_admin, active, (pin_hash is not null) as has_pin,
           coalesce(locked_until > now(), false) as locked
    from members
    order by active desc, name
  `;

  return (
    <>
      <Header member={me} />
      <main className="stack">
        <AdminNav current="members" />
        <Notice message={msg} tone={tone} />

        <section className="card">
          <form action={addMembersAction} className="stack">
            <h2>회원 추가</h2>
            <label className="field">
              이름
              <textarea id="names" name="names" placeholder={'김철수\n이영희\n박민수'} rows={4} />
              <span className="field-hint">한 줄에 한 명씩, 또는 쉼표로 구분해 여러 명을 한 번에 추가할 수 있습니다.</span>
            </label>
            <SubmitButton>추가</SubmitButton>
          </form>
        </section>

        <section className="card stack-sm">
          <h2>회원 목록 ({members.filter((m) => m.active).length}명)</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>PIN</th>
                  <th style={{ textAlign: 'right' }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} style={m.active ? undefined : { opacity: 0.55 }}>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <strong>{m.name}</strong>
                        {m.is_admin && <span className="badge badge-open">관리자</span>}
                        {!m.active && <span className="badge">비활성</span>}
                      </div>
                    </td>
                    <td className="small" style={{ whiteSpace: 'nowrap' }}>
                      {m.locked ? '잠김' : m.has_pin ? '설정됨' : <span className="muted">미설정</span>}
                    </td>
                    <td>
                      <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                        {m.has_pin && (
                          <form action={resetPinAction}>
                            <input type="hidden" name="memberId" value={m.id} />
                            <SubmitButton className="btn btn-secondary btn-small" confirmMessage={`${m.name}님의 PIN을 초기화할까요?`}>
                              PIN 초기화
                            </SubmitButton>
                          </form>
                        )}
                        {m.id !== me.id && (
                          <>
                            <form action={toggleAdminAction}>
                              <input type="hidden" name="memberId" value={m.id} />
                              <SubmitButton className="btn btn-secondary btn-small">
                                {m.is_admin ? '관리자 해제' : '관리자 지정'}
                              </SubmitButton>
                            </form>
                            <form action={toggleActiveAction}>
                              <input type="hidden" name="memberId" value={m.id} />
                              <SubmitButton className="btn btn-secondary btn-small">
                                {m.active ? '비활성화' : '활성화'}
                              </SubmitButton>
                            </form>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small" style={{ margin: 0 }}>
            탈퇴한 회원은 비활성화하면 로그인 목록과 명단 편성에서 빠지고, 지난 기록은 그대로 남습니다.
          </p>
        </section>
      </main>
    </>
  );
}
