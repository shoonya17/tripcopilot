import Link from 'next/link';
import { getActorContext } from '@/lib/auth';
import { listExpenses } from '@/lib/domain/expenses';
import ExpensePanel from '@/components/ExpensePanel';

export default async function ExpensesPage({ params }: { params: Promise<{ tripId: string }> }) {
  const a = await getActorContext();
  const { tripId } = await params;
  const data = await listExpenses(tripId, a.tenantId, { page: 1, pageSize: 100 });
  const items = Array.isArray(data.items) ? data.items : [];

  return (
    <main className="shell">
      <Link href={`/trips/${tripId}`}>← Trip Wallet</Link>
      <section className="hero">
        <p className="small muted">SPEND</p>
        <h1>Expenses</h1>
        <p className="muted">
          {data.total === 0 ? 'No expenses yet. Record your first one below.' : `${data.total} recorded.`}
        </p>
      </section>

      <ExpensePanel tripId={tripId} />

      {items.length > 0 && (
        <div className="card list" style={{ marginTop: 16 }}>
          {items.map((e: any) => (
            <div key={e.expenseId} className="row">
              <div>
                <strong>{e.merchantOrDescription}</strong>
                <div className="small muted">
                  {new Date(e.incurredAt).toLocaleString()} · {e.category ?? 'Uncategorised'} · row v{e.rowVersion}
                </div>
              </div>
              <strong>{e.currency} {Number(e.amount).toFixed(2)}</strong>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}