import { ReminderSettings, Medication, Slot, dosesForDate, isMedTaken, Dose, getAppointments, getDoctors } from "./storage";
import type { DocMeta } from "./vault-db";

export type ReminderKind = "mood" | "med" | "appt" | "expiry";

const EXPIRY_OFFSETS = [{ d: 30, label: "dans 30 jours" }, { d: 7, label: "dans 7 jours" }, { d: 1, label: "demain" }, { d: 0, label: "aujourd'hui" }];

/** Reminders for documents approaching their expiry date (6h catch-up window). */
export function expiryReminders(docs: DocMeta[], now = new Date()): DueReminder[] {
  const out: DueReminder[] = [];
  for (const doc of docs) {
    if (!doc.expiryDate || !doc.notifyExpiry) continue;
    const exp = new Date(doc.expiryDate + "T09:00:00").getTime();
    if (exp < now.getTime() - 864e5) continue;
    for (const off of EXPIRY_OFFSETS) {
      const target = exp - off.d * 864e5;
      const dt = now.getTime() - target;
      if (dt >= 0 && dt <= 6 * 3600e3) {
        out.push({
          slot: `${doc.id}|expiry|${off.d}`, kind: "expiry", time: doc.expiryDate,
          title: `${doc.title} à renouveler ${off.label}`,
          body: `Ce document arrive à expiration le ${doc.expiryDate}.`,
        });
      }
    }
  }
  return out;
}

const APPT_OFFSETS: { min: number; label: string }[] = [
  { min: 1440, label: "dans 24 h" },
  { min: 720, label: "dans 12 h" },
  { min: 60, label: "dans 1 h" },
  { min: 15, label: "dans 15 minutes" },
];

export interface DueReminder {
  slot: string;
  kind: ReminderKind;
  time: string;
  title: string;
  body: string;
  medId?: string;
  barcode?: string;
}

function slotDueNow(s: Slot, now: Date, graceMin: number): boolean {
  if (s.days.length && !s.days.includes(now.getDay())) return false;
  const [h, m] = s.time.split(":").map(Number);
  const target = h * 60 + m;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin >= target && nowMin - target <= graceMin;
}

export function dueReminders(settings: ReminderSettings, meds: Medication[], now = new Date(), graceMin = 3): DueReminder[] {
  const date = now.toISOString().slice(0, 10);
  const out: DueReminder[] = [];
  for (const s of settings.moodSlots)
    if (slotDueNow(s, now, graceMin))
      out.push({ slot: `${date}T${s.time}|mood`, kind: "mood", time: s.time, title: "Comment te sens-tu ?", body: "C'est l'heure de noter ton humeur." });
  for (const m of meds)
    for (const s of m.slots)
      if (slotDueNow(s, now, graceMin))
        out.push({
          slot: `${date}T${s.time}|med|${m.id}`, kind: "med", time: s.time, medId: m.id, barcode: m.barcode,
          title: `Médicament — ${m.name}`,
          body: m.dose ? `Il est temps de prendre ${m.name} (${m.dose}).` : `Il est temps de prendre ${m.name}.`,
        });

  // Appointment reminders (24h / 12h / 1h / 15min) with a 30-min catch-up window.
  const doctors = getDoctors();
  for (const a of getAppointments()) {
    const apptMs = new Date(a.datetime).getTime();
    if (apptMs < now.getTime()) continue;
    const doc = a.doctorId ? doctors.find((d) => d.id === a.doctorId) : undefined;
    const who = doc ? `${doc.name}${doc.specialty ? ` (${doc.specialty})` : ""}` : a.title;
    for (const off of APPT_OFFSETS) {
      const target = apptMs - off.min * 60000;
      const dt = now.getTime() - target;
      if (dt >= 0 && dt <= 30 * 60000) {
        out.push({
          slot: `${a.id}|appt|${off.min}`, kind: "appt",
          time: new Date(a.datetime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
          title: `Rendez-vous ${off.label}`,
          body: `${a.title}${doc ? ` — ${who}` : ""}${a.address ? ` · ${a.address}` : ""}`,
        });
      }
    }
  }
  return out;
}

// ── Medication status for the dashboard ──────────────────────────────────────
export interface MedStatus {
  doses: (Dose & { taken: boolean; min: number })[];
  total: number;
  takenCount: number;
  allTaken: boolean;
  next: { dose: Dose; msUntil: number } | null;   // next upcoming, not taken
  overdue: { dose: Dose; msLate: number } | null;  // earliest passed & not taken
}

export function todayMedStatus(now = new Date()): MedStatus {
  const date = now.toISOString().slice(0, 10);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowMs = now.getTime();
  const doses = dosesForDate(date).map((d) => {
    const [h, m] = d.time.split(":").map(Number);
    return { ...d, taken: isMedTaken(date, d.medId, d.time), min: h * 60 + m };
  });
  const takenCount = doses.filter((d) => d.taken).length;

  const dueMs = (min: number) => { const t = new Date(now); t.setHours(0, 0, 0, 0); return t.getTime() + min * 60000; };

  const upcoming = doses.filter((d) => !d.taken && d.min >= nowMin).sort((a, b) => a.min - b.min);
  const late = doses.filter((d) => !d.taken && d.min < nowMin).sort((a, b) => a.min - b.min);

  return {
    doses,
    total: doses.length,
    takenCount,
    allTaken: doses.length > 0 && takenCount === doses.length,
    next: upcoming.length ? { dose: upcoming[0], msUntil: dueMs(upcoming[0].min) - nowMs } : null,
    overdue: late.length ? { dose: late[0], msLate: nowMs - dueMs(late[0].min) } : null,
  };
}

export function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}`;
  if (m > 0) return `${m} min ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

// ── Notifications ────────────────────────────────────────────────────────────
export async function requestNotifPermission(): Promise<boolean> {
  // Native (Capacitor): ask the OS notification permission, not the Web Notification API
  // (which is unavailable inside the iOS WebView).
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      let st = await LocalNotifications.checkPermissions();
      if (st.display !== "granted") st = await LocalNotifications.requestPermissions();
      return st.display === "granted";
    }
  } catch { /* fall through to web */ }
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try { return (await Notification.requestPermission()) === "granted"; } catch { return false; }
}
export function notify(title: string, body: string): void {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      const n = new Notification(title, { body, icon: "./icon-192.png", badge: "./icon-192.png", tag: "moody", renotify: true } as NotificationOptions);
      n.onclick = () => { window.focus(); n.close(); };
    }
  } catch { /* ignore */ }
}
export function vibrate(pattern: number | number[]): void { try { navigator.vibrate?.(pattern); } catch { /* ignore */ } }

// ── Alarm sound (WebAudio) ───────────────────────────────────────────────────
export class Alarm {
  private ctx: AudioContext | null = null;
  private timer: number | null = null;
  private loud: boolean;
  playing = false;
  constructor(loud: boolean) { this.loud = loud; }
  private beep(freq: number, dur: number, gainVal: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = "sine"; osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(gainVal, this.ctx.currentTime + 0.02);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(); osc.stop(this.ctx.currentTime + dur + 0.02);
  }
  start() {
    if (this.playing) return; this.playing = true;
    try { this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); this.ctx.resume(); } catch { /* */ }
    const cycle = () => {
      if (this.loud) { this.beep(880, 0.28, 0.9); setTimeout(() => this.beep(660, 0.28, 0.9), 300); vibrate([400, 120, 400]); }
      else { this.beep(660, 0.16, 0.28); vibrate(120); }
    };
    cycle();
    this.timer = window.setInterval(cycle, this.loud ? 900 : 4000);
  }
  stop() {
    this.playing = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    try { navigator.vibrate?.(0); } catch { /* */ }
    try { this.ctx?.close(); } catch { /* */ }
    this.ctx = null;
  }
}
