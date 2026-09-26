type AnySegment = {
  segmentId: string;
  segmentType: string;
  supplierName: string | null;
  bookingReference: string | null;
  departureLocal: Date | null;
  arrivalLocal: Date | null;
  departureLocation: string | null;
  arrivalLocation: string | null;
  status: string;
};

function formatLocal(value: Date | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function buildPlainText(tripTitle: string, segments: AnySegment[]): string {
  const lines: string[] = [];
  lines.push(`TRIP: ${tripTitle}`);
  lines.push('');
  segments.forEach((s, i) => {
    lines.push(
      `${i + 1}. ${s.segmentType}${s.supplierName ? ` — ${s.supplierName}` : ''}`,
    );
    lines.push(`   From: ${s.departureLocation ?? '—'}`);
    lines.push(`   To:   ${s.arrivalLocation ?? '—'}`);
    lines.push(`   Departure: ${formatLocal(s.departureLocal)}`);
    if (s.arrivalLocal) {
      lines.push(`   Arrival:   ${formatLocal(s.arrivalLocal)}`);
    }
    if (s.bookingReference) {
      lines.push(`   Ref: ${s.bookingReference}`);
    }
    lines.push(`   Status: ${s.status}`);
    lines.push('');
  });
  return lines.join('\n');
}

export default function OfflineItinerary({
  tripTitle,
  segments,
}: {
  tripTitle: string;
  segments: AnySegment[];
}) {
  if (segments.length === 0) return null;

  const text = buildPlainText(tripTitle, segments);

  return (
    <div className="card">
      <h2 className="section-title">Offline itinerary</h2>
      <p className="small muted">
        Plain-text copy of your trip. Readable without a network connection.
      </p>
      <pre
        style={{
          marginTop: 12,
          padding: 12,
          background: 'hsl(var(--muted) / 0.3)',
          borderRadius: 8,
          fontSize: 13,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          fontFamily: 'ui-monospace, monospace',
          overflowX: 'auto',
        }}
      >
        {text}
      </pre>
    </div>
  );
}