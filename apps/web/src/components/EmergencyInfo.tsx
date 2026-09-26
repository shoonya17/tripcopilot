type CountryEmergency = {
  name: string;
  police?: string;
  ambulance?: string;
  fire?: string;
  all?: string;
  notes?: string;
};

const EMERGENCY_BY_TZ: Record<string, CountryEmergency> = {
  'Asia/Kolkata': { name: 'India', police: '100', ambulance: '108', fire: '101', all: '112' },
  'Asia/Kathmandu': { name: 'Nepal', police: '100', ambulance: '102', fire: '101', all: '112' },
  'Asia/Colombo': { name: 'Sri Lanka', police: '119', ambulance: '110', fire: '111', all: '112' },
  'Asia/Dhaka': { name: 'Bangladesh', police: '999', ambulance: '999', fire: '999' },
  'Asia/Dubai': { name: 'UAE', police: '999', ambulance: '998', fire: '997' },
  'Asia/Singapore': { name: 'Singapore', police: '999', ambulance: '995', fire: '995' },
  'Asia/Bangkok': { name: 'Thailand', police: '191', ambulance: '1669', fire: '199', all: '112' },
  'Asia/Hong_Kong': { name: 'Hong Kong', police: '999', ambulance: '999', fire: '999' },
  'Asia/Shanghai': { name: 'China', police: '110', ambulance: '120', fire: '119' },
  'Asia/Tokyo': { name: 'Japan', police: '110', ambulance: '119', fire: '119' },
  'Asia/Seoul': { name: 'South Korea', police: '112', ambulance: '119', fire: '119' },
  'Asia/Jakarta': { name: 'Indonesia', police: '110', ambulance: '118', fire: '113', all: '112' },
  'Asia/Kuala_Lumpur': { name: 'Malaysia', police: '999', ambulance: '999', fire: '999' },
  'Europe/London': { name: 'UK', all: '999', notes: '112 also works' },
  'Europe/Paris': { name: 'France', all: '112', notes: '15 medical, 17 police, 18 fire' },
  'Europe/Berlin': { name: 'Germany', all: '112', notes: '110 police' },
  'Europe/Rome': { name: 'Italy', all: '112' },
  'Europe/Madrid': { name: 'Spain', all: '112' },
  'Europe/Amsterdam': { name: 'Netherlands', all: '112' },
  'America/New_York': { name: 'USA', all: '911' },
  'America/Chicago': { name: 'USA', all: '911' },
  'America/Denver': { name: 'USA', all: '911' },
  'America/Los_Angeles': { name: 'USA', all: '911' },
  'America/Sao_Paulo': { name: 'Brazil', police: '190', ambulance: '192', fire: '193' },
  'Australia/Sydney': { name: 'Australia', all: '000', notes: '112 also works' },
  'Australia/Melbourne': { name: 'Australia', all: '000', notes: '112 also works' },
  'Pacific/Auckland': { name: 'New Zealand', all: '111' },
};

function NumberLink({ number, label }: { number: string; label: string }) {
  return (
    <a
      href={`tel:${number}`}
      style={{
        marginRight: 16,
        textDecoration: 'none',
        color: 'inherit',
        display: 'inline-block',
      }}
    >
      <strong
        style={{
          color: 'hsl(var(--primary))',
          fontFamily: 'ui-monospace, monospace',
          fontSize: '1.05rem',
        }}
      >
        {number}
      </strong>{' '}
      <span className="small muted">— {label}</span>
    </a>
  );
}

export default function EmergencyInfo({
  timezones,
}: {
  timezones: (string | null | undefined)[];
}) {
  const seen = new Set<string>();
  const countries: CountryEmergency[] = [];

  for (const tz of timezones) {
    if (!tz) continue;
    const c = EMERGENCY_BY_TZ[tz];
    if (!c) continue;
    if (seen.has(c.name)) continue;
    seen.add(c.name);
    countries.push(c);
  }

  if (countries.length === 0) return null;

  return (
    <div className="card" style={{ borderColor: 'hsl(var(--destructive) / 0.3)' }}>
      <h2 className="section-title">Emergency numbers</h2>
      <p className="small muted">
        Tap a number to call. Confirm locally on arrival.
      </p>
      <div style={{ marginTop: 12 }}>
        {countries.map(c => (
          <div
            key={c.name}
            style={{
              padding: '10px 0',
              borderBottom: '1px solid hsl(var(--border))',
            }}
          >
            <strong style={{ display: 'block', marginBottom: 6 }}>
              {c.name}
            </strong>
            <div>
              {c.all && <NumberLink number={c.all} label="all emergencies" />}
              {c.police && <NumberLink number={c.police} label="police" />}
              {c.ambulance && (
                <NumberLink number={c.ambulance} label="ambulance" />
              )}
              {c.fire && <NumberLink number={c.fire} label="fire" />}
            </div>
            {c.notes && (
              <div className="small muted" style={{ marginTop: 4 }}>
                {c.notes}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}