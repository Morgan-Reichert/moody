// Moody — local-first data layer (100% device, no server)

export interface MoodEntry {
  id: string;
  datetime: string;                 // ISO 8601
  date: string;                     // YYYY-MM-DD (grouping)
  mood: number;                     // 1..10
  energy?: number;                  // 1..3  (bas / moyen / haut)
  appetite?: number;                // 1..3  (faible / ok / fort)
  sleep?: number;                   // hours
  note?: string;
  medsTaken?: Record<string, boolean>; // medId -> taken
}

export interface Medication {
  id: string;
  name: string;
  dose?: string;
  times: string[];                  // ["21:00"]
  barcode?: string;                 // registered code for scan-to-dismiss
  tint?: "mint" | "peach" | "lilac" | "butter";
}

export interface ReminderSettings {
  moodTimes: string[];              // ["09:00", "20:00"]
  loudAlarm: boolean;               // ultra-loud looping alarm for meds
  scanToDismiss: boolean;           // require camera scan to silence a med alarm
  snoozeMinutes: number;            // re-alert after N min if not validated
  notifications: boolean;           // OS notifications opted-in
}

const K_MOOD = "moody_mood";
const K_MEDS = "moody_meds";
const K_SET = "moody_settings";
const K_LOG = "moody_reminder_log";  // "YYYY-MM-DDTHH:mm|kind|refId" -> handled

export const DEFAULT_SETTINGS: ReminderSettings = {
  moodTimes: ["09:00", "20:00"],
  loudAlarm: false,
  scanToDismiss: false,
  snoozeMinutes: 10,
  notifications: false,
};

// ── tiny reactive layer ──────────────────────────────────────────────────────
type Listener = () => void;
const listeners = new Set<Listener>();
export function onChange(fn: Listener): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }
function emit() { listeners.forEach((l) => l()); }

const isBrowser = () => typeof window !== "undefined";
function read<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; }
  catch { return fallback; }
}
function write<T>(key: string, val: T) {
  if (!isBrowser()) return;
  localStorage.setItem(key, JSON.stringify(val));
  emit();
}
export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
export function todayISO(): string { return new Date().toISOString().slice(0, 10); }

// ── one-time migration from the old MindScope keys ───────────────────────────
export function migrate(): void {
  if (!isBrowser()) return;
  try {
    if (!localStorage.getItem(K_MOOD)) {
      const old = localStorage.getItem("mindscope_mood_v2");
      if (old) {
        const arr = JSON.parse(old) as any[];
        const mapped: MoodEntry[] = arr.map((e) => ({
          id: e.id ?? uid(), datetime: e.datetime, date: e.date, mood: e.mood,
          energy: e.energy, appetite: e.appetite, sleep: e.sleep, note: e.note,
          medsTaken: e.medicationsTaken,
        }));
        localStorage.setItem(K_MOOD, JSON.stringify(mapped));
      }
    }
    if (!localStorage.getItem(K_MEDS)) {
      const oldMeds = localStorage.getItem("mindscope_meds");
      if (oldMeds) {
        const p = JSON.parse(oldMeds) as { medications?: string[] };
        const meds: Medication[] = (p.medications ?? []).map((name) => ({ id: uid(), name, times: [] }));
        localStorage.setItem(K_MEDS, JSON.stringify(meds));
      }
    }
  } catch { /* ignore */ }
}

// ── Mood entries ─────────────────────────────────────────────────────────────
export function getEntries(): MoodEntry[] {
  return read<MoodEntry[]>(K_MOOD, []).sort((a, b) => a.datetime.localeCompare(b.datetime));
}
export function saveEntry(entry: Omit<MoodEntry, "id" | "date"> & { id?: string; date?: string }): MoodEntry {
  const all = getEntries();
  const complete: MoodEntry = {
    ...entry,
    id: entry.id ?? uid(),
    date: entry.date ?? entry.datetime.slice(0, 10),
  };
  const i = all.findIndex((e) => e.id === complete.id);
  if (i >= 0) all[i] = complete; else all.push(complete);
  // keep ~1 year
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 366);
  const cut = cutoff.toISOString().slice(0, 10);
  write(K_MOOD, all.filter((e) => e.date >= cut));
  return complete;
}
export function deleteEntry(id: string): void {
  write(K_MOOD, getEntries().filter((e) => e.id !== id));
}
export function getTodayEntries(): MoodEntry[] {
  const t = todayISO();
  return getEntries().filter((e) => e.date === t);
}
export function getEntriesForDate(date: string): MoodEntry[] {
  return getEntries().filter((e) => e.date === date);
}

/** average mood per day for the last `days` days (null when no entry) */
export function dailySeries(days: number): { date: string; value: number | null }[] {
  const map = new Map<string, number[]>();
  for (const e of getEntries()) {
    if (!map.has(e.date)) map.set(e.date, []);
    map.get(e.date)!.push(e.mood);
  }
  const out: { date: string; value: number | null }[] = [];
  const d = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(d); day.setDate(d.getDate() - i);
    const key = day.toISOString().slice(0, 10);
    const arr = map.get(key);
    out.push({ date: key, value: arr && arr.length ? round1(arr.reduce((a, b) => a + b, 0) / arr.length) : null });
  }
  return out;
}
export function average(days: number): number | null {
  const vals = dailySeries(days).map((d) => d.value).filter((v): v is number => v != null);
  return vals.length ? round1(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
}
/** consecutive days (ending today or yesterday) with at least one entry */
export function streak(): number {
  const days = new Set(getEntries().map((e) => e.date));
  let n = 0;
  const d = new Date();
  // allow the streak to still count if today not logged yet
  if (!days.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  while (days.has(d.toISOString().slice(0, 10))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function round1(n: number) { return Math.round(n * 10) / 10; }

// ── Medications ──────────────────────────────────────────────────────────────
export function getMeds(): Medication[] { return read<Medication[]>(K_MEDS, []); }
export function saveMed(med: Omit<Medication, "id"> & { id?: string }): Medication {
  const all = getMeds();
  const complete: Medication = { ...med, id: med.id ?? uid() };
  const i = all.findIndex((m) => m.id === complete.id);
  if (i >= 0) all[i] = complete; else all.push(complete);
  write(K_MEDS, all);
  return complete;
}
export function deleteMed(id: string): void {
  write(K_MEDS, getMeds().filter((m) => m.id !== id));
}

// ── Settings ─────────────────────────────────────────────────────────────────
export function getSettings(): ReminderSettings {
  return { ...DEFAULT_SETTINGS, ...read<Partial<ReminderSettings>>(K_SET, {}) };
}
export function saveSettings(patch: Partial<ReminderSettings>): ReminderSettings {
  const next = { ...getSettings(), ...patch };
  write(K_SET, next);
  return next;
}

// ── Reminder de-dup log (so a due reminder fires once per slot) ───────────────
export function reminderHandled(slot: string): boolean {
  return read<Record<string, number>>(K_LOG, {})[slot] != null;
}
export function markReminder(slot: string): void {
  const log = read<Record<string, number>>(K_LOG, {});
  log[slot] = Date.now();
  // prune entries older than 2 days
  const cut = Date.now() - 2 * 864e5;
  for (const k of Object.keys(log)) if (log[k] < cut) delete log[k];
  write(K_LOG, log);
}

// ── labels ───────────────────────────────────────────────────────────────────
export const MOOD_LABELS: Record<number, string> = {
  1: "Très bas", 2: "Bas", 3: "Difficile", 4: "Morose", 5: "Mitigé",
  6: "Correct", 7: "Plutôt bien", 8: "Bien", 9: "Très bien", 10: "Radieux",
};
export function moodLabel(v: number): string { return MOOD_LABELS[Math.round(v)] ?? "—"; }
export const LEVEL3 = ["Bas", "Moyen", "Haut"] as const;
export const APPETITE3 = ["Faible", "Ok", "Fort"] as const;
