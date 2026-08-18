// Live weather via Open-Meteo (free, no API key, CORS-enabled).

export interface Weather {
  temp: number;
  code: number;
  isDay: boolean;
  label: string;
  place?: string;
  at: number;      // fetched ms
}

const CACHE = "moody_weather";

const CODE_LABELS: Record<number, string> = {
  0: "Ciel dégagé", 1: "Plutôt dégagé", 2: "Partiellement nuageux", 3: "Couvert",
  45: "Brouillard", 48: "Brouillard givrant",
  51: "Bruine légère", 53: "Bruine", 55: "Bruine dense",
  61: "Pluie légère", 63: "Pluie", 65: "Forte pluie",
  66: "Pluie verglaçante", 67: "Pluie verglaçante",
  71: "Neige légère", 73: "Neige", 75: "Forte neige", 77: "Grésil",
  80: "Averses", 81: "Averses", 82: "Fortes averses",
  85: "Averses de neige", 86: "Averses de neige",
  95: "Orage", 96: "Orage grêle", 99: "Orage grêle",
};
export function weatherLabel(code: number): string { return CODE_LABELS[code] ?? "—"; }

export function getCachedWeather(): Weather | null {
  if (typeof window === "undefined") return null;
  try { const v = localStorage.getItem(CACHE); return v ? JSON.parse(v) : null; } catch { return null; }
}

async function getPosition(): Promise<{ coords: { latitude: number; longitude: number } }> {
  // On native iOS/Android, WKWebView disables navigator.geolocation — use the Capacitor plugin.
  let native = false;
  try { const { Capacitor } = await import("@capacitor/core"); native = Capacitor.isNativePlatform(); } catch { /* */ }
  if (native) {
    const { Geolocation } = await import("@capacitor/geolocation");
    try { await Geolocation.requestPermissions(); } catch { /* */ }
    const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 8000, maximumAge: 15 * 60 * 1000 });
    return { coords: { latitude: p.coords.latitude, longitude: p.coords.longitude } };
  }
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("no geoloc"));
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000, maximumAge: 15 * 60 * 1000 });
  });
}

async function reverseGeocode(lat: number, lon: number): Promise<string | undefined> {
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=fr&latitude=${lat}&longitude=${lon}`);
    if (!r.ok) return undefined;
    const d = await r.json();
    return d?.results?.[0]?.name;
  } catch { return undefined; }
}

export async function fetchWeather(): Promise<Weather> {
  const pos = await getPosition();
  const { latitude: lat, longitude: lon } = pos.coords;
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day`);
  if (!r.ok) throw new Error("weather http " + r.status);
  const d = await r.json();
  const cur = d.current;
  const place = await reverseGeocode(lat, lon);
  const w: Weather = {
    temp: Math.round(cur.temperature_2m),
    code: cur.weather_code,
    isDay: cur.is_day === 1,
    label: weatherLabel(cur.weather_code),
    place,
    at: Date.now(),
  };
  try { localStorage.setItem(CACHE, JSON.stringify(w)); } catch { /* */ }
  return w;
}
