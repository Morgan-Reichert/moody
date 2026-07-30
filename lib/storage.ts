// Moody — local-first data layer (100% device, no server)
import { useEffect, useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────
export interface MoodEntry {
  id: string;
  datetime: string;                 // ISO 8601
  date: string;                     // YYYY-MM-DD (grouping)
  mood: number;                     // 1..10
  energy?: number;                  // 1..5
  appetite?: number;                // 1..4  (rien / peu / moyen / fort)
  sleep?: number;                   // hours, 0.5 steps
  sport?: number;                   // minutes (module)
  water?: number;                   // glasses (module)
  note?: string;
  medsTaken?: Record<string, boolean>;
}

/** A scheduled time, optionally limited to certain weekdays (0=Sun … 6=Sat). */
export interface Slot {
  time: string;                     // "HH:mm"
  days: number[];                   // [] or 7 items = every day
}

export interface Medication {
  id: string;
  name: string;
  dose?: string;
  slots: Slot[];
  barcode?: string;
}

export type ModuleKey = "sport" | "water";

export interface ReminderSettings {
  moodSlots: Slot[];
  loudAlarm: boolean;
  scanToDismiss: boolean;
  snoozeMinutes: number;
  notifications: boolean;
  modules: ModuleKey[];             // enabled optional trackers
}

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
export const DAY_LABELS = ["D", "L", "M", "M", "J", "V", "S"];
export const DAY_FULL = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

export const DEFAULT_SETTINGS: ReminderSettings = {
  moodSlots: [{ time: "09:00", days: ALL_DAYS }, { time: "20:00", days: ALL_DAYS }],
  loudAlarm: false,
  scanToDismiss: false,
  snoozeMinutes: 10,
  notifications: false,
  modules: [],
};

const K_MOOD = "moody_mood";
const K_MEDS = "moody_meds";
const K_SET = "moody_settings";
const K_INTAKE = "moody_intake";   // "date|medId|time" -> takenAt(ms)
const K_LOG = "moody_reminder_log";

// ── reactive layer (in-tab + cross-tab) ──────────────────────────────────────
type Listener = () => void;
const listeners = new Set<Listener>();
export function onChange(fn: Listener): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }
function emit() { listeners.forEach((l) => l()); }

let crossTabBound = false;
function bindCrossTab() {
  if (crossTabBound || typeof window === "undefined") return;
  crossTabBound = true;
  window.addEventListener("storage", (e) => {
    if (e.key && e.key.startsWith("moody_")) emit();
  });
}

/** React hook: re-renders the component whenever any Moody data changes. */
export function useStore(): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    bindCrossTab();
    return onChange(() => setV((x) => x + 1));
  }, []);
  return v;
}

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
export function uid(): string { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }
export function todayISO(): string { return new Date().toISOString().slice(0, 10); }

// ── migration ────────────────────────────────────────────────────────────────
export function migrate(): void {
  if (!isBrowser()) return;
  try {
    if (!localStorage.getItem(K_MOOD)) {
      const old = localStorage.getItem("mindscope_mood_v2");
      if (old) {
        const arr = JSON.parse(old) as any[];
        localStorage.setItem(K_MOOD, JSON.stringify(arr.map((e) => ({
          id: e.id ?? uid(), datetime: e.datetime, date: e.date, mood: e.mood,
          energy: e.energy, appetite: e.appetite, sleep: e.sleep, note: e.note,
          medsTaken: e.medicationsTaken,
        }))));
      }
    }
    // upgrade meds from {times:string[]} to {slots:Slot[]}
    const rawMeds = localStorage.getItem(K_MEDS);
    if (rawMeds) {
      const meds = JSON.parse(rawMeds) as any[];
      let changed = false;
      for (const m of meds) {
        if (!m.slots) { m.slots = (m.times ?? []).map((t: string) => ({ time: t, days: ALL_DAYS })); delete m.times; changed = true; }
      }
      if (changed) localStorage.setItem(K_MEDS, JSON.stringify(meds));
    }
    // upgrade settings moodTimes -> moodSlots
    const rawSet = localStorage.getItem(K_SET);
    if (rawSet) {
      const s = JSON.parse(rawSet);
      if (s.moodTimes && !s.moodSlots) {
        s.moodSlots = s.moodTimes.map((t: string) => ({ time: t, days: ALL_DAYS }));
        delete s.moodTimes;
        localStorage.setItem(K_SET, JSON.stringify(s));
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
  const complete: MoodEntry = { ...entry, id: entry.id ?? uid(), date: entry.date ?? entry.datetime.slice(0, 10) };
  const i = all.findIndex((e) => e.id === complete.id);
  if (i >= 0) all[i] = complete; else all.push(complete);
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 366);
  const cut = cutoff.toISOString().slice(0, 10);
  write(K_MOOD, all.filter((e) => e.date >= cut));
  return complete;
}
export function deleteEntry(id: string): void { write(K_MOOD, getEntries().filter((e) => e.id !== id)); }
export function getTodayEntries(): MoodEntry[] { const t = todayISO(); return getEntries().filter((e) => e.date === t); }

export function dailySeries(days: number): { date: string; value: number | null }[] {
  const map = new Map<string, number[]>();
  for (const e of getEntries()) { if (!map.has(e.date)) map.set(e.date, []); map.get(e.date)!.push(e.mood); }
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
export function streak(): number {
  const days = new Set(getEntries().map((e) => e.date));
  let n = 0; const d = new Date();
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
export function deleteMed(id: string): void { write(K_MEDS, getMeds().filter((m) => m.id !== id)); }

/** All med doses scheduled for a given date (respecting per-day slots), sorted by time. */
export interface Dose { medId: string; name: string; dose?: string; time: string; barcode?: string; }
export function dosesForDate(date: string): Dose[] {
  const wd = new Date(date + "T12:00:00").getDay();
  const out: Dose[] = [];
  for (const m of getMeds())
    for (const s of m.slots)
      if (!s.days.length || s.days.includes(wd))
        out.push({ medId: m.id, name: m.name, dose: m.dose, time: s.time, barcode: m.barcode });
  return out.sort((a, b) => a.time.localeCompare(b.time));
}

// ── Medication intake log ────────────────────────────────────────────────────
function intakeKey(date: string, medId: string, time: string) { return `${date}|${medId}|${time}`; }
export function getIntake(): Record<string, number> { return read<Record<string, number>>(K_INTAKE, {}); }
export function isMedTaken(date: string, medId: string, time: string): boolean {
  return getIntake()[intakeKey(date, medId, time)] != null;
}
export function setMedTaken(date: string, medId: string, time: string, taken: boolean): void {
  const log = getIntake(); const k = intakeKey(date, medId, time);
  if (taken) log[k] = Date.now(); else delete log[k];
  write(K_INTAKE, log);
}

// ── Settings ─────────────────────────────────────────────────────────────────
export function getSettings(): ReminderSettings { return { ...DEFAULT_SETTINGS, ...read<Partial<ReminderSettings>>(K_SET, {}) }; }
export function saveSettings(patch: Partial<ReminderSettings>): ReminderSettings {
  const next = { ...getSettings(), ...patch }; write(K_SET, next); return next;
}
export function toggleModule(key: ModuleKey): ReminderSettings {
  const s = getSettings();
  const modules = s.modules.includes(key) ? s.modules.filter((m) => m !== key) : [...s.modules, key];
  return saveSettings({ modules });
}

// ── Reminder de-dup log ──────────────────────────────────────────────────────
export function reminderHandled(slot: string): boolean { return read<Record<string, number>>(K_LOG, {})[slot] != null; }
export function markReminder(slot: string): void {
  const log = read<Record<string, number>>(K_LOG, {});
  log[slot] = Date.now();
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
export const ENERGY_LABELS = ["Vidé", "Bas", "Moyen", "Bon", "Plein d'énergie"];
export const APPETITE_LABELS = ["Pas du tout", "Peu", "Moyen", "Fort"];
export const MODULES: { key: ModuleKey; name: string; desc: string }[] = [
  { key: "sport", name: "Sport & activité", desc: "Minutes d'activité + objectif motivant" },
  { key: "water", name: "Hydratation", desc: "Verres d'eau dans la journée" },
];
