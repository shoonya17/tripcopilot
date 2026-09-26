import { getWeatherForLocation, type Weather } from '@/lib/domain/weather';

type AnySegment = {
  segmentId: string;
  segmentType: string;
  supplierName: string | null;
  departureLocation: string | null;
  arrivalLocation: string | null;
  departureUtc: Date | null;
  status: string;
};

function formatDate(dateIso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${dateIso}T00:00:00Z`));
}

function WeatherLine({ w }: { w: Weather }) {
  const parts: string[] = [];
  if (w.tempHighC !== null && w.tempLowC !== null) {
    parts.push(`${Math.round(w.tempHighC)}° / ${Math.round(w.tempLowC)}°`);
  }
  parts.push(w.weatherSummary);
  if (w.precipitationProbability !== null) {
    parts.push(`${w.precipitationProbability}% precip`);
  }
  if (w.windMaxKmh !== null) {
    parts.push(`${Math.round(w.windMaxKmh)} km/h wind`);
  }
  return (
    <span className="small muted">
      {formatDate(w.dateIso)} · {parts.join(' · ')}
    </span>
  );
}

export default async function SafetyBrief({
  segments,
}: {
  segments: AnySegment[];
}) {
  const upcoming = segments
    .filter(s => s.status !== 'CANCELLED' && s.status !== 'COMPLETED')
    .filter(s => s.departureUtc && s.departureLocation)
    .slice(0, 4);

  if (upcoming.length === 0) {
    return null;
  }

  const results = await Promise.all(
    upcoming.map(async s => ({
      segment: s,
      weather: await getWeatherForLocation(
        s.departureLocation,
        s.departureUtc,
      ),
    })),
  );

  const withWeather = results.filter(r => r.weather !== null);
  if (withWeather.length === 0) {
    return null;
  }

  return (
    <div className="card">
      <h2 className="section-title">Weather outlook</h2>
      <p className="small muted">
        Forecast for the departure location and date of each upcoming segment.
      </p>
      <div className="list" style={{ marginTop: 12 }}>
        {withWeather.map(({ segment, weather }) => (
          <div className="row" key={segment.segmentId}>
            <div>
              <strong>
                {segment.departureLocation ?? 'Unknown'}
              </strong>
              <div style={{ marginTop: 4 }}>
                <WeatherLine w={weather!} />
              </div>
              {weather!.advisory && (
                <div
                  className="small"
                  style={{
                    marginTop: 4,
                    color: '#b45309',
                    fontWeight: 500,
                  }}
                >
                  ⚠ {weather!.advisory}
                </div>
              )}
            </div>
            <span className="pill">{segment.segmentType}</span>
          </div>
        ))}
      </div>
    </div>
  );
}