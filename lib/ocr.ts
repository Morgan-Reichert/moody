import { DocType } from "./vault-db";

export interface OcrResult {
  text: string;
  type: DocType;
  docDate?: string;      // ISO YYYY-MM-DD
  expiryDate?: string;   // ISO
  prescriber?: string;
}

// ── OCR runner (Tesseract.js, client-side) ───────────────────────────────────
export async function ocrImage(file: Blob, onProgress?: (p: number) => void): Promise<string> {
  const Tesseract: any = (await import("tesseract.js")).default;
  const { data } = await Tesseract.recognize(file, "fra", {
    logger: (m: any) => { if (m.status === "recognizing text" && onProgress) onProgress(m.progress); },
  });
  return (data?.text ?? "") as string;
}

// ── parsing heuristics ───────────────────────────────────────────────────────
const MONTHS: Record<string, number> = {
  janvier: 1, fevrier: 2, "février": 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, aout: 8, "août": 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12, "décembre": 12,
};

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** all dates found, with their character index */
function findDates(text: string): { at: number; iso: string }[] {
  const out: { at: number; iso: string }[] = [];
  const numeric = /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/g;
  let m: RegExpExecArray | null;
  while ((m = numeric.exec(text))) {
    let [_, d, mo, y] = m;
    let yy = parseInt(y); if (yy < 100) yy += 2000;
    const dd = parseInt(d), mm = parseInt(mo);
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) out.push({ at: m.index, iso: iso(yy, mm, dd) });
  }
  const textual = /\b(\d{1,2})(?:er)?\s+([a-zA-Zéûàôîèç]+)\s+(\d{4})\b/g;
  while ((m = textual.exec(text))) {
    const dd = parseInt(m[1]); const mo = MONTHS[m[2].toLowerCase()]; const yy = parseInt(m[3]);
    if (mo && dd >= 1 && dd <= 31) out.push({ at: m.index, iso: iso(yy, mo, dd) });
  }
  return out.sort((a, b) => a.at - b.at);
}

export function classify(text: string): DocType {
  const t = text.toLowerCase();
  if (/ordonnance|prescription|posologie|comprim|g[ée]lule|renouvel|matin.*(midi|soir)|q\.?s\.?p|traitement pour/.test(t)) return "ordonnance";
  if (/certificat|atteste|certifie|aptitude|inaptitude|arr[êe]t de travail|dispense|contre-indication/.test(t)) return "certificat";
  if (/analyse|laboratoire|biologie|r[ée]sultat|pr[ée]l[èe]vement|h[ée]moglobine|glyc[ée]mie|s[ée]rologie|num[ée]ration/.test(t)) return "analyse";
  return "autre";
}

function findPrescriber(text: string): string | undefined {
  const m = text.match(/(?:Dr|Dr\.|Docteur)\s+([A-ZÀ-Þ][A-Za-zÀ-ÿ'’.-]+(?:\s+[A-ZÀ-Þ][A-Za-zÀ-ÿ'’.-]+){0,2})/);
  if (m) return `Dr ${m[1].trim()}`;
  return undefined;
}

function findExpiry(text: string, dates: { at: number; iso: string }[]): string | undefined {
  const kw = /(valable jusqu'?au|à renouveler avant|renouvelable jusqu'?au|expire le|p[ée]remption|valable jusque|jusqu'?au)/i;
  const m = kw.exec(text);
  if (m) {
    // first date appearing after the keyword
    const after = dates.filter((d) => d.at >= m.index).sort((a, b) => a.at - b.at)[0];
    if (after) return after.iso;
  }
  return undefined;
}

/** Extract key notice sections (effets indésirables, contre-indications…) from OCR text. */
export function parseNotice(text: string): { effets?: string[]; risques?: string[]; conseils?: string[] } {
  const grab = (label: RegExp): string[] | undefined => {
    const idx = text.search(label);
    if (idx < 0) return undefined;
    const chunk = text.slice(idx, idx + 800);
    const lines = chunk.split(/[\n•·▪◦;]|(?:\.\s)/).map((s) => s.replace(/\s+/g, " ").trim())
      .filter((s) => s.length > 14 && s.length < 170).slice(1, 5);
    return lines.length ? lines : undefined;
  };
  return {
    effets: grab(/effets?\s+ind[eé]sirables?/i),
    risques: grab(/(contre-?indications?|mises?\s+en\s+garde|pr[eé]cautions?\s+d'?emploi|ne\s+(pas|jamais))/i),
    conseils: grab(/(mode\s+d'?emploi|posologie|comment\s+prendre|conseils?)/i),
  };
}

export function parseDocument(text: string): OcrResult {
  const dates = findDates(text);
  const type = classify(text);
  const docDate = dates[0]?.iso;
  const expiry = findExpiry(text, dates) ?? (dates.length > 1 ? dates[dates.length - 1].iso : undefined);
  return { text, type, docDate, expiryDate: expiry, prescriber: findPrescriber(text) };
}
