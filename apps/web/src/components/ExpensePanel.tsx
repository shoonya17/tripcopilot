'use client';
import { useState } from 'react';

function key() { return crypto.randomUUID(); }
async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(path, { ...init, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message ?? `Request failed (${response.status})`);
  return body.data;
}

type PendingExpense = {
  expenseId: string;
  amount: number | string;
  currency: string;
  merchantOrDescription: string;
  incurredAt: string | Date;
  rowVersion: number;
  confidence?: number | string | null;
};

function formatDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value));
}

export default function ExpensePanel({
  tripId,
  pending = [],
}: {
  tripId: string;
  pending?: PendingExpense[];
}) {
  const [expense, setExpense] = useState({
    amount: '', currency: 'INR', category: '', merchant_or_description: '',
    incurred_at: new Date().toISOString().slice(0, 16), location: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [localPending, setLocalPending] = useState<PendingExpense[]>(pending);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  function flash(fn: () => Promise<unknown>) {
    setMessage(''); setError(''); setBusy(true);
    fn()
      .then(() => { setMessage('Expense recorded. Reload to see it in the list.'); window.location.reload(); })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setBusy(false));
  }

  async function confirmSuggestion(p: PendingExpense) {
    setRowBusy(p.expenseId); setError('');
    try {
      await request(`/api/v1/trips/${tripId}/expenses/${p.expenseId}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ row_version: p.rowVersion }),
      });
      setLocalPending(prev => prev.filter(x => x.expenseId !== p.expenseId));
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setRowBusy(null);
    }
  }

  async function dismissSuggestion(p: PendingExpense) {
    setRowBusy(p.expenseId); setError('');
    try {
      await request(`/api/v1/trips/${tripId}/expenses/${p.expenseId}`, {
        method: 'DELETE',
        body: JSON.stringify({ row_version: p.rowVersion }),
      });
      setLocalPending(prev => prev.filter(x => x.expenseId !== p.expenseId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setRowBusy(null);
    }
  }

  return (
    <section className="stack">
      {localPending.length > 0 && (
        <div className="card" style={{ borderColor: '#bbf7d0', background: '#f6fffb' }}>
          <h2 className="section-title">Suggested from your booking</h2>
          <p className="small muted">
            We found the fare on a document you uploaded. Confirm to add it to
            your trip ledger, or dismiss if it isn&apos;t right.
          </p>
          <div className="list" style={{ marginTop: 12 }}>
            {localPending.map(p => (
              <div className="row" key={p.expenseId}>
                <div>
                  <strong>{p.merchantOrDescription}</strong>
                  <div className="small muted">
                    {formatDateTime(p.incurredAt)} ·{' '}
                    {p.currency} {Number(p.amount).toFixed(2)}
                    {p.confidence != null
                      ? ` · confidence ${Math.round(Number(p.confidence) * 100)}%`
                      : ''}
                  </div>
                </div>
                <div className="actions">
                  <button
                    className="btn"
                    disabled={rowBusy === p.expenseId}
                    onClick={() => confirmSuggestion(p)}
                  >
                    {rowBusy === p.expenseId ? '…' : 'Confirm'}
                  </button>
                  <button
                    className="btn secondary"
                    disabled={rowBusy === p.expenseId}
                    onClick={() => dismissSuggestion(p)}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="section-title">Record an expense</h2>
        <div className="grid grid-3">
          {([
            ['amount', 'Amount'], ['currency', 'Currency'], ['category', 'Category'],
            ['merchant_or_description', 'Merchant / description'],
            ['incurred_at', 'Incurred at'], ['location', 'Location'],
          ] as const).map(([k, l]) => (
            <div className="field" key={k}>
              <label>{l}</label>
              <input value={(expense as any)[k]} onChange={e => setExpense(x => ({ ...x, [k]: e.target.value }))} />
            </div>
          ))}
        </div>
        <button className="btn" style={{ marginTop: 12 }} disabled={busy || !expense.amount} onClick={() => flash(async () =>
          request(`/api/v1/trips/${tripId}/expenses`, {
            method: 'POST',
            headers: { 'Idempotency-Key': key() },
            body: JSON.stringify({
              ...expense,
              amount: Number(expense.amount),
              incurred_at: new Date(expense.incurred_at).toISOString(),
              category: expense.category || undefined,
              location: expense.location || undefined,
            }),
          })
        )}>Record expense</button>
      </div>

      {(message || error) && (
        <div className="card" style={{ borderColor: error ? '#fecaca' : '#bbf7d0', background: error ? '#fff7f7' : '#f6fffb' }}>
          <strong>{error ? 'Action failed' : 'Action complete'}</strong>
          <div className="small muted" style={{ marginTop: 4 }}>{error || message}</div>
        </div>
      )}
    </section>
  );
}