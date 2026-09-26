'use client';
import { useState } from 'react';

type Contact = {
  trustedContactId: string;
  name: string;
  contactType: string;
  contactValue: string;
};

async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error?.message ?? `Request failed (${response.status})`);
  }
  return body.data;
}

export default function TrustedContactsPanel({
  initialContacts,
}: {
  initialContacts: Contact[];
}) {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    contactType: 'PHONE',
    contactValue: '',
  });

  async function add() {
    setError('');
    setBusy(true);
    try {
      const created = await request('/api/v1/traveler/contacts', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          contact_type: form.contactType,
          contact_value: form.contactValue,
        }),
      });
      setContacts(prev => [...prev, created]);
      setForm({ name: '', contactType: 'PHONE', contactValue: '' });
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add contact');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError('');
    setBusy(true);
    try {
      await request(`/api/v1/traveler/contacts/${id}`, {
        method: 'DELETE',
      });
      setContacts(prev => prev.filter(c => c.trustedContactId !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove contact');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2 className="section-title">Trusted contacts</h2>
      <p className="small muted">
        People you would want contacted in an emergency. Stored on your
        account, not shared with the trip.
      </p>

      {contacts.length === 0 && !adding && (
        <p className="muted" style={{ marginTop: 12 }}>
          No trusted contacts yet.
        </p>
      )}

      {contacts.length > 0 && (
        <div className="list" style={{ marginTop: 12 }}>
          {contacts.map(c => (
            <div
              className="row"
              key={c.trustedContactId}
              style={{ borderBottom: '1px solid hsl(var(--border))' }}
            >
              <div>
                <strong>{c.name}</strong>
                <div className="small muted" style={{ marginTop: 2 }}>
                  {c.contactType === 'EMAIL' ? '📧' : '📞'}{' '}
                  {c.contactType === 'EMAIL' ? (
                    <a
                      href={`mailto:${c.contactValue}`}
                      style={{ color: 'hsl(var(--primary))', textDecoration: 'none' }}
                    >
                      {c.contactValue}
                    </a>
                  ) : (
                    <a
                      href={`tel:${c.contactValue}`}
                      style={{ color: 'hsl(var(--primary))', textDecoration: 'none' }}
                    >
                      {c.contactValue}
                    </a>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="btn secondary"
                disabled={busy}
                onClick={() => remove(c.trustedContactId)}
                style={{ color: '#b91c1c' }}
                aria-label={`Remove ${c.name}`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {!adding && (
        <button
          type="button"
          className="btn"
          style={{ marginTop: 12 }}
          onClick={() => setAdding(true)}
          disabled={busy}
        >
          + Add contact
        </button>
      )}

      {adding && (
        <div
          className="card"
          style={{ marginTop: 12, background: 'hsl(var(--muted) / 0.3)' }}
        >
          <div className="grid grid-3">
            <div className="field">
              <label>Name</label>
              <input
                value={form.name}
                onChange={e => setForm(x => ({ ...x, name: e.target.value }))}
                placeholder="Mom, Rahul, Emergency…"
              />
            </div>
            <div className="field">
              <label>Type</label>
              <select
                value={form.contactType}
                onChange={e =>
                  setForm(x => ({ ...x, contactType: e.target.value }))
                }
              >
                <option value="PHONE">Phone</option>
                <option value="EMAIL">Email</option>
              </select>
            </div>
            <div className="field">
              <label>
                {form.contactType === 'EMAIL' ? 'Email address' : 'Phone number'}
              </label>
              <input
                value={form.contactValue}
                onChange={e =>
                  setForm(x => ({ ...x, contactValue: e.target.value }))
                }
                placeholder={
                  form.contactType === 'EMAIL'
                    ? 'mom@example.com'
                    : '+91 98xxx xxxxx'
                }
              />
            </div>
          </div>
          <div className="actions" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn"
              onClick={add}
              disabled={busy || !form.name || !form.contactValue}
            >
              {busy ? 'Saving…' : 'Save contact'}
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                setAdding(false);
                setForm({ name: '', contactType: 'PHONE', contactValue: '' });
                setError('');
              }}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="small" style={{ marginTop: 8, color: '#b91c1c' }}>
          {error}
        </p>
      )}
    </div>
  );
}