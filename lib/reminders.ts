import { ReminderSettings, Medication, Slot, dosesForDate, isMedTaken, Dose } from "./storage";

export type ReminderKind = "mood" | "med";

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
