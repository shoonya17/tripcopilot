'use client';
import { useState } from 'react';

function key() {
  return crypto.randomUUID();
}

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
    throw new Error(
      body.error?.message ?? `Request failed (${response.status})`,
    );
  }
  return body.data;
}

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation not supported in this browser'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
}

export default function ShareLocationButton({
  tripId,
  consentGranted,
}: {
  tripId: string;
  consentGranted: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function share() {
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      const current = await request(`/api/v1/trips/${tripId}/safety`);
      const consentId =
        current.consent?.status === 'GRANTED'
          ? current.consent.consentId
          : null;
      if (!consentId) {
        throw new Error('Grant safety consent first');
      }

      const pos = await getPosition();
      await request(`/api/v1/trips/${tripId}/safety/share-location`, {
        method: 'POST',
        headers: { 'Idempotency-Key': key() },
        body: JSON.stringify({
          lat: pos.coords.latitude,
          long: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy ?? 50),
          consent_reference: consentId,
        }),
      });
      setSuccess(
        `Location shared (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`,
      );
    } catch (e) {
      const code = (e as GeolocationPositionError)?.code;
      if (code === 1) {
        setError('Location permission denied. Enable location access and try again.');
      } else if (code === 2) {
        setError('Location unavailable. Check your network and GPS.');
      } else if (code === 3) {
        setError('Location request timed out. Try again.');
      } else {
        setError(e instanceof Error ? e.message : 'Failed to share location');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        className="btn"
        disabled={busy || !consentGranted}
        onClick={share}
        style={{ marginTop: 12 }}
      >
        {busy ? 'Getting location…' : '📍 Share my current location'}
      </button>
      {!consentGranted && (
        <p className="small muted" style={{ marginTop: 8 }}>
          Grant consent above to enable this.
        </p>
      )}
      {success && (
        <p className="small" style={{ marginTop: 8, color: '#047857' }}>
          ✓ {success}
        </p>
      )}
      {error && (
        <p className="small" style={{ marginTop: 8, color: '#b91c1c' }}>
          {error}
        </p>
      )}
    </div>
  );
}