'use client';
import { useState } from 'react';

function key() { return crypto.randomUUID(); }
async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(path, { ...init, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message ?? `Request failed (${response.status})`);
  return body.data;
}

export default function ExpensePanel({ tripId }: { tripId: string }) {
  const [expense, setExpense] = useState({
    amount: '', currency: 'INR', category: '', merchant_or_description: '',
    incurred_at: new Date().toISOString().slice(0, 16), location: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function flash(fn: () => Promise<unknown>) {
    setMessage(''); setError(''); setBusy(true);
    fn()
      .then(() => { setMessage('Expense recorded. Reload to see it in the list.'); window.location.reload(); })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setBusy(false));
  }

  return (
    <section className="stack">
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