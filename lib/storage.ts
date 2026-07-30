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
  // health / symptoms
  symptoms?: string[];
  symptomIntensity?: number;        // 1..3 (léger / modéré / fort)
  symptomNote?: string;
  symptomAdvice?: string;
}

/** A scheduled time, optionally limited to certain weekdays (0=Sun … 6=Sat). */
export interface Slot {
  time: string;                     // "HH:mm"
  days: number[];                   // [] or 7 items = every day
}

export interface MedHighlights {
  molecule?: string; classe?: string; risques?: string[]; effets?: string[]; conseils?: string[];
}
export interface Medication {
  id: string;
  name: string;
  dose?: string;
  slots: Slot[];
  barcode?: string;
  highlights?: MedHighlights;   // notice highlights (from catalog or scanned)
}

export type ModuleKey = "sport" | "water" | "addiction";

export interface Addiction {
  id: string;
  name: string;         // "Cigarette", "Alcool", …
  createdAt: string;    // ISO date
  goal?: number;        // optional daily limit (reduce mode); undefined = abstinence
  unit?: string;        // "cigarette", "verre" …
}

export interface ReminderSettings {
  moodSlots: Slot[];
  loudAlarm: boolean;
  scanToDismiss: boolean;
  snoozeMinutes: number;
  notifications: boolean;
  modules: ModuleKey[];             // enabled optional trackers
  // profile / personalization
  name?: string;
  mantra?: string;
  weather?: boolean;                // show live weather on dashboard
  // security
  pinEnabled?: boolean;
  pinHash?: string;                 // sha-256(salt + pin)
  pinSalt?: string;
  faceId?: boolean;
  faceCredId?: string;              // base64url WebAuthn credential id
  // dashboard card order
  dashOrder?: string[];
  onboarded?: boolean;
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
const K_WATER = "moody_water";      // date -> cl
const K_ADDICT = "moody_addictions";
const K_ADDICT_LOG = "moody_addiction_log"; // [{id, at(iso)}]

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
export function getDashOrder(): string[] { return getSettings().dashOrder ?? []; }
export function saveDashOrder(order: string[]): void { saveSettings({ dashOrder: order }); }
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

// ── Medical space : fiche, médecins, rendez-vous ─────────────────────────────
const K_MEDICAL = "moody_medical";
const K_DOCTORS = "moody_doctors";
const K_APPTS = "moody_appointments";

export interface MedicalProfile {
  fullName?: string;
  birthDate?: string;
  sex?: string;
  height?: string;         // cm
  weight?: string;         // kg
  bloodType?: string;      // A+, O-…
  conditions?: string;     // maladies / pathologies
  allergies?: string;
  treatments?: string;     // traitements en cours
  history?: string;        // antécédents / passé médical
  surgeries?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  notes?: string;
}
export function getMedicalProfile(): MedicalProfile { return read<MedicalProfile>(K_MEDICAL, {}); }
export function saveMedicalProfile(patch: Partial<MedicalProfile>): MedicalProfile {
  const next = { ...getMedicalProfile(), ...patch }; write(K_MEDICAL, next); return next;
}

export interface Doctor {
  id: string; name: string; specialty: string;
  phone?: string; email?: string; address?: string; notes?: string;
}
export function getDoctors(): Doctor[] { return read<Doctor[]>(K_DOCTORS, []); }
export function saveDoctor(d: Omit<Doctor, "id"> & { id?: string }): Doctor {
  const all = getDoctors(); const complete = { ...d, id: d.id ?? uid() };
  const i = all.findIndex((x) => x.id === complete.id); if (i >= 0) all[i] = complete; else all.push(complete);
  write(K_DOCTORS, all); return complete;
}
export function deleteDoctor(id: string): void { write(K_DOCTORS, getDoctors().filter((d) => d.id !== id)); }

export interface Appointment {
  id: string; title: string; datetime: string; // ISO
  doctorId?: string; address?: string; notes?: string;
}
export function getAppointments(): Appointment[] {
  return read<Appointment[]>(K_APPTS, []).sort((a, b) => a.datetime.localeCompare(b.datetime));
}
export function saveAppointment(a: Omit<Appointment, "id"> & { id?: string }): Appointment {
  const all = getAppointments(); const complete = { ...a, id: a.id ?? uid() };
  const i = all.findIndex((x) => x.id === complete.id); if (i >= 0) all[i] = complete; else all.push(complete);
  write(K_APPTS, all); return complete;
}
export function deleteAppointment(id: string): void { write(K_APPTS, getAppointments().filter((a) => a.id !== id)); }
export function upcomingAppointments(now = new Date()): Appointment[] {
  return getAppointments().filter((a) => new Date(a.datetime).getTime() >= now.getTime() - 3600e3);
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
  { key: "water", name: "Hydratation", desc: "Carte au dashboard : litres bus + ajout rapide" },
  { key: "sport", name: "Sport & activité", desc: "Minutes d'activité à la saisie d'humeur" },
  { key: "addiction", name: "Contrôle des addictions", desc: "Streaks, encouragements et journal de consommation" },
];

// ── Hydration (dashboard card) ───────────────────────────────────────────────
export const WATER_GOAL_CL = 150; // 1,5 L
export function getWaterToday(): number { return read<Record<string, number>>(K_WATER, {})[todayISO()] ?? 0; }
export function addWater(cl: number): void {
  const map = read<Record<string, number>>(K_WATER, {});
  const t = todayISO();
  map[t] = Math.max(0, (map[t] ?? 0) + cl);
  // prune > 120 days
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 120);
  const cut = cutoff.toISOString().slice(0, 10);
  for (const k of Object.keys(map)) if (k < cut) delete map[k];
  write(K_WATER, map);
}
export function resetWaterToday(): void {
  const map = read<Record<string, number>>(K_WATER, {}); delete map[todayISO()]; write(K_WATER, map);
}

// ── Addictions ───────────────────────────────────────────────────────────────
interface AddictLog { id: string; at: string; }
export function getAddictions(): Addiction[] { return read<Addiction[]>(K_ADDICT, []); }
export function saveAddiction(a: Omit<Addiction, "id" | "createdAt"> & { id?: string; createdAt?: string }): Addiction {
  const all = getAddictions();
  const complete: Addiction = { ...a, id: a.id ?? uid(), createdAt: a.createdAt ?? new Date().toISOString() };
  const i = all.findIndex((x) => x.id === complete.id);
  if (i >= 0) all[i] = complete; else all.push(complete);
  write(K_ADDICT, all);
  return complete;
}
export function deleteAddiction(id: string): void {
  write(K_ADDICT, getAddictions().filter((a) => a.id !== id));
  write(K_ADDICT_LOG, getAddictLog().filter((l) => l.id !== id));
}
function getAddictLog(): AddictLog[] { return read<AddictLog[]>(K_ADDICT_LOG, []); }
export function logConsumption(id: string): void {
  const log = getAddictLog(); log.push({ id, at: new Date().toISOString() }); write(K_ADDICT_LOG, log);
}
export function undoLastConsumption(id: string): void {
  const log = getAddictLog();
  for (let i = log.length - 1; i >= 0; i--) if (log[i].id === id) { log.splice(i, 1); break; }
  write(K_ADDICT_LOG, log);
}
function daysBetween(a: Date, b: Date): number {
  const A = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const B = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((B.getTime() - A.getTime()) / 864e5);
}
export interface AddictionStat {
  streakDays: number;      // full clean days since last consumption (or since start)
  lastAt: string | null;
  todayCount: number;
  totalCount: number;
  bestStreak: number;
  cleanSince: string;      // ISO date the current streak started
}
export function addictionStat(a: Addiction, now = new Date()): AddictionStat {
  const logs = getAddictLog().filter((l) => l.id === a.id).sort((x, y) => x.at.localeCompare(y.at));
  const today = now.toISOString().slice(0, 10);
  const todayCount = logs.filter((l) => l.at.slice(0, 10) === today).length;
  const lastAt = logs.length ? logs[logs.length - 1].at : null;
  const startD = new Date(a.createdAt);
  const cleanSinceDate = lastAt ? new Date(lastAt) : startD;
  const streakDays = Math.max(0, daysBetween(cleanSinceDate, now));
  // best streak across history
  const boundaries = [startD, ...logs.map((l) => new Date(l.at)), now];
  let best = 0;
  for (let i = 1; i < boundaries.length; i++) best = Math.max(best, daysBetween(boundaries[i - 1], boundaries[i]));
  return { streakDays, lastAt, todayCount, totalCount: logs.length, bestStreak: best, cleanSince: cleanSinceDate.toISOString().slice(0, 10) };
}
export const ADDICT_MILESTONES = [1, 3, 7, 14, 30, 60, 90, 180, 365];
export function nextMilestone(days: number): number { return ADDICT_MILESTONES.find((m) => m > days) ?? (Math.floor(days / 365) + 1) * 365; }
export function encouragement(days: number, name: string): string {
  if (days <= 0) return `Nouveau départ. Chaque heure sans ${name.toLowerCase()} compte — tu peux le faire.`;
  if (days === 1) return `1 jour ! Le plus dur est derrière toi. Continue.`;
  if (days < 7) return `${days} jours sans ${name.toLowerCase()}. Ta volonté paie déjà, tiens bon.`;
  if (days < 30) return `${days} jours ! Ton corps te remercie. Fier·e de toi.`;
  if (days < 90) return `${days} jours — c'est une vraie habitude qui s'installe. Bravo !`;
  return `${days} jours. Tu es un exemple de constance. Immense respect.`;
}
