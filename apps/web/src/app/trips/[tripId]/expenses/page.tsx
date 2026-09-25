import Link from 'next/link';
import { getActorContext } from '@/lib/auth';
import { listExpenses } from '@/lib/domain/expenses';
import ExpensePanel from '@/components/ExpensePanel';

export default async function ExpensesPage({ params }: { params: Promise<{ tripId: string }> }) {
  const a = await getActorContext();
  const { tripId } = await params;
  const data = await listExpenses(tripId, a.tenantId, { page: 1, pageSize: 100 });
  const all = Array.isArray(data.items) ? data.items : [];

  const pending = all.filter(
    (e: any) => e.sourceType === 'EXTRACTED_FARE' && e.userConfirmed !== true,
  );
  const confirmed = all.filter(
    (e: any) => !(e.sourceType === 'EXTRACTED_FARE' && e.userConfirmed !== true),
  );

  const confirmedTotal = confirmed.reduce(
    (s: number, e: any) => s + Number(e.amount),
    0,
  );
  const primaryCurrency = confirmed[0]?.currency ?? 'INR';

  return (
    <main className="shell">
      <Link href={`/trips/${tripId}`}>← Trip Wallet</Link>
      <section className="hero">
        <p className="small muted">SPEND</p>
        <h1>Expenses</h1>
        <p className="muted">
          {all.length === 0
            ? 'No expenses yet. Record your first one below.'
            : `${confirmed.length} confirmed · ${primaryCurrency} ${confirmedTotal.toFixed(2)}${pending.length ? ` · ${pending.length} pending` : ''}`}
        </p>
      </section>

      <ExpensePanel
        tripId={tripId}
        pending={pending.map((e: any) => ({
          expenseId: e.expenseId,
          amount: String(e.amount),
          currency: e.currency,
          merchantOrDescription: e.merchantOrDescription,
          incurredAt: new Date(e.incurredAt).toISOString(),
          rowVersion: e.rowVersion,
          confidence: e.confidence == null ? null : String(e.confidence),
        }))}
      />

      {confirmed.length > 0 && (
        <div className="card list" style={{ marginTop: 16 }}>
          {confirmed.map((e: any) => (
            <div key={e.expenseId} className="row">
              <div>
                <strong>{e.merchantOrDescription}</strong>
                <div className="small muted">
                  {new Intl.DateTimeFormat('en-GB', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: 'UTC',
                  }).format(new Date(e.incurredAt))}{' '}
                  · {e.category ?? 'Uncategorised'} · row v{e.rowVersion}
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