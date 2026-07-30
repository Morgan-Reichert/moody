export interface Helpline { name: string; desc: string; tel: string; }
export interface CountryHelp { code: string; name: string; flag: string; lines: Helpline[] }

export const COUNTRIES: CountryHelp[] = [
  { code: "FR", name: "France", flag: "🇫🇷", lines: [
    { name: "3114 — Prévention du suicide", desc: "Écoute 24h/24, 7j/7, gratuit et confidentiel", tel: "3114" },
    { name: "SOS Amitié", desc: "Écoute anonyme, tous les jours", tel: "0972394050" },
    { name: "Fil Santé Jeunes", desc: "Pour les jeunes, 9h-23h (anonyme, gratuit)", tel: "0800235236" },
    { name: "SAMU — 15", desc: "Urgence médicale vitale", tel: "15" },
    { name: "Urgences — 112", desc: "Numéro d'urgence européen", tel: "112" },
  ] },
  { code: "BE", name: "Belgique", flag: "🇧🇪", lines: [
    { name: "Centre de Prévention du Suicide", desc: "Écoute 24h/24, gratuit", tel: "080032123" },
    { name: "Télé-Accueil — 107", desc: "Écoute 24h/24, anonyme", tel: "107" },
    { name: "Urgences — 112", desc: "Numéro d'urgence", tel: "112" },
  ] },
  { code: "CH", name: "Suisse", flag: "🇨🇭", lines: [
    { name: "La Main Tendue — 143", desc: "Écoute 24h/24", tel: "143" },
    { name: "Pro Juventute — 147", desc: "Conseil aux jeunes, 24h/24", tel: "147" },
    { name: "Urgences — 144", desc: "Ambulance / urgence médicale", tel: "144" },
  ] },
  { code: "CA", name: "Canada", flag: "🇨🇦", lines: [
    { name: "9-8-8", desc: "Ligne d'aide en cas de crise (suicide), 24h/24", tel: "988" },
    { name: "Urgences — 911", desc: "Urgence", tel: "911" },
  ] },
  { code: "LU", name: "Luxembourg", flag: "🇱🇺", lines: [
    { name: "SOS Détresse", desc: "Écoute et soutien", tel: "454545" },
    { name: "Urgences — 112", desc: "Numéro d'urgence", tel: "112" },
  ] },
];

export const INTERNATIONAL: Helpline[] = [
  { name: "Urgences — 112", desc: "Numéro d'urgence dans une grande partie du monde", tel: "112" },
  { name: "Befrienders Worldwide", desc: "Trouver une ligne d'écoute près de chez toi (findahelpline.com)", tel: "" },
];

export function linesFor(code?: string): { name: string; lines: Helpline[]; isInternational: boolean } {
  const c = COUNTRIES.find((x) => x.code === code);
  if (c) return { name: c.name, lines: c.lines, isInternational: false };
  return { name: "International", lines: INTERNATIONAL, isInternational: true };
}

/** Reverse-geocode a position to a 2-letter country code (free, no key). */
export async function countryFromPosition(): Promise<string | null> {
  const pos = await new Promise<GeolocationPosition>((res, rej) => {
    if (!navigator.geolocation) return rej(new Error("no geo"));
    navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000, maximumAge: 3600e3 });
  });
  const { latitude, longitude } = pos.coords;
  const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=fr`);
  if (!r.ok) return null;
  const d = await r.json();
  return (d?.countryCode as string) || null;
}
