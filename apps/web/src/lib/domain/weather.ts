export type Weather = {
  locationLabel: string;
  resolvedName: string;
  latitude: number;
  longitude: number;
  dateIso: string;
  tempHighC: number | null;
  tempLowC: number | null;
  precipitationProbability: number | null;
  weatherCode: number | null;
  weatherSummary: string;
  windMaxKmh: number | null;
  advisory: string | null;
};

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';
const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';

// Simple in-memory caches for the process lifetime.
// Geocoding results are stable, forecasts change slowly.
const geocodeCache = new Map<string, { lat: number; lon: number; name: string } | null>();
const forecastCache = new Map<string, Weather>();

function cleanQuery(input: string): string {
  return input
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// WMO weather interpretation codes → short human label
function summarizeCode(code: number | null): string {
  if (code === null) return 'No forecast';
  if (code === 0) return 'Clear';
  if (code === 1) return 'Mainly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Fog';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 65) return 'Rain';
  if (code === 66 || code === 67) return 'Freezing rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code >= 85 && code <= 86) return 'Snow showers';
  if (code >= 95 && code <= 99) return 'Thunderstorm';
  return 'Mixed';
}

function advisoryFor(
  code: number | null,
  precip: number | null,
  wind: number | null,
  high: number | null,
  low: number | null,
): string | null {
  if (code !== null && code >= 95) return 'Thunderstorms expected — consider delays';
  if (wind !== null && wind >= 50) return 'Strong winds — travel may be disrupted';
  if (precip !== null && precip >= 80) return 'Heavy rain likely — allow extra time';
  if (high !== null && high >= 40) return 'Extreme heat — hydrate and avoid midday sun';
  if (low !== null && low <= 0) return 'Freezing temperatures — pack a warm layer';
  return null;
}

async function geocode(
  label: string,
): Promise<{ lat: number; lon: number; name: string } | null> {
  const key = cleanQuery(label).toLowerCase();
  if (!key) return null;
  if (geocodeCache.has(key)) return geocodeCache.get(key) ?? null;

  const url =
    `${NOMINATIM_BASE}?q=${encodeURIComponent(key)}` +
    `&format=json&limit=1&addressdetails=0`;

  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'TripCopilot/1.0 (safety brief)',
        Accept: 'application/json',
      },
      // Nominatim asks for reasonable caching; process-level cache is fine
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!r.ok) {
      geocodeCache.set(key, null);
      return null;
    }
    const rows = (await r.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;
    if (!Array.isArray(rows) || rows.length === 0) {
      geocodeCache.set(key, null);
      return null;
    }
    const hit = rows[0];
    const lat = Number(hit.lat);
    const lon = Number(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      geocodeCache.set(key, null);
      return null;
    }
    const resolved = { lat, lon, name: hit.display_name };
    geocodeCache.set(key, resolved);
    return resolved;
  } catch {
    geocodeCache.set(key, null);
    return null;
  }
}

export async function getWeatherForLocation(
  locationLabel: string | null | undefined,
  dateUtc: Date | string | null | undefined,
): Promise<Weather | null> {
  if (!locationLabel) return null;
  if (!dateUtc) return null;

  const date = new Date(dateUtc);
  if (Number.isNaN(date.getTime())) return null;

  // Only forecast within a reasonable window — Open-Meteo handles up to 16 days out
  const now = new Date();
  const diffDays = Math.round((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < -1 || diffDays > 14) return null;

  const dateIso = date.toISOString().slice(0, 10);

  const cacheKey = `${cleanQuery(locationLabel).toLowerCase()}::${dateIso}`;
  if (forecastCache.has(cacheKey)) return forecastCache.get(cacheKey) ?? null;

  const geo = await geocode(locationLabel);
  if (!geo) return null;

  const url =
    `${OPEN_METEO_BASE}?latitude=${geo.lat}&longitude=${geo.lon}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,wind_speed_10m_max` +
    `&timezone=auto&start_date=${dateIso}&end_date=${dateIso}`;

  try {
    const r = await fetch(url, { next: { revalidate: 60 * 60 } });
    if (!r.ok) return null;
    const body = (await r.json()) as {
      daily?: {
        time?: string[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        precipitation_probability_max?: number[];
        weather_code?: number[];
        wind_speed_10m_max?: number[];
      };
    };
    const d = body.daily;
    if (!d || !d.time || d.time.length === 0) return null;

    const high = d.temperature_2m_max?.[0] ?? null;
    const low = d.temperature_2m_min?.[0] ?? null;
    const precip = d.precipitation_probability_max?.[0] ?? null;
    const code = d.weather_code?.[0] ?? null;
    const wind = d.wind_speed_10m_max?.[0] ?? null;

    const weather: Weather = {
      locationLabel,
      resolvedName: geo.name,
      latitude: geo.lat,
      longitude: geo.lon,
      dateIso,
      tempHighC: high,
      tempLowC: low,
      precipitationProbability: precip,
      weatherCode: code,
      weatherSummary: summarizeCode(code),
      windMaxKmh: wind,
      advisory: advisoryFor(code, precip, wind, high, low),
    };
    forecastCache.set(cacheKey, weather);
    return weather;
  } catch {
    return null;
  }
}