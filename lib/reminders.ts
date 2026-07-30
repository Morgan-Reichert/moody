import { Medication, ReminderSettings } from "./storage";

export type ReminderKind = "mood" | "med";

export interface DueReminder {
  slot: string;        // unique key for this occurrence (dedup)
  kind: ReminderKind;
  time: string;        // "HH:mm"
  title: string;
  body: string;
  med?: Medication;    // present when kind === "med"
}

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function slotKey(date: string, time: string, kind: ReminderKind, ref: string): string {
  return `${date}T${time}|${kind}|${ref}`;
}

/**
 * Reminders whose scheduled minute is now or up to `graceMin` minutes ago
 * (so we still catch it if the tab was briefly backgrounded).
 */
export function dueReminders(
  settings: ReminderSettings,
  meds: Medication[],
  now = new Date(),
  graceMin = 3,
): DueReminder[] {
  const date = now.toISOString().slice(0, 10);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const out: DueReminder[] = [];

  const withinWindow = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const target = h * 60 + m;
    return nowMin >= target && nowMin - target <= graceMin;
  };

  for (const t of settings.moodTimes) {
    if (withinWindow(t)) {
      out.push({
        slot: slotKey(date, t, "mood", "mood"),
        kind: "mood", time: t,
        title: "Comment te sens-tu ?",
        body: "C'est l'heure de noter ton humeur.",
      });
    }
  }
  for (const med of meds) {
    for (const t of med.times) {
      if (withinWindow(t)) {
        out.push({
          slot: slotKey(date, t, "med", med.id),
          kind: "med", time: t, med,
          title: `Médicament — ${med.name}`,
          body: med.dose ? `Il est temps de prendre ${med.name} (${med.dose}).` : `Il est temps de prendre ${med.name}.`,
        });
      }
    }
  }
  return out;
}

/** Next upcoming reminder today (for the dashboard) */
export function nextReminders(settings: ReminderSettings, meds: Medication[], now = new Date()) {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const items: { time: string; kind: ReminderKind; label: string; sub: string }[] = [];
  for (const t of settings.moodTimes) items.push({ time: t, kind: "mood", label: "Humeur", sub: "Rappel quotidien" });
  for (const med of meds) for (const t of med.times)
    items.push({ time: t, kind: "med", label: med.name, sub: med.dose || "Traitement" });
  return items
    .map((i) => { const [h, m] = i.time.split(":").map(Number); return { ...i, min: h * 60 + m }; })
    .sort((a, b) => a.min - b.min)
    .map((i) => ({ ...i, upcoming: i.min >= nowMin }));
}

// ── Notifications ────────────────────────────────────────────────────────────
export async function requestNotifPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try { return (await Notification.requestPermission()) === "granted"; }
  catch { return false; }
}
export function notify(title: string, body: string): void {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      const n = new Notification(title, { body, icon: "./icon-192.png", badge: "./icon-192.png", tag: "moody", renotify: true } as NotificationOptions);
      n.onclick = () => { window.focus(); n.close(); };
    }
  } catch { /* ignore */ }
}
export function vibrate(pattern: number | number[]): void {
  try { navigator.vibrate?.(pattern); } catch { /* ignore */ }
}

// ── Alarm sound (WebAudio, works while the tab is open/foreground) ───────────
export class Alarm {
  private ctx: AudioContext | null = null;
  private timer: number | null = null;
  private loud: boolean;
  private vibTimer: number | null = null;
  playing = false;

  constructor(loud: boolean) { this.loud = loud; }

  private beep(freq: number, dur: number, gainVal: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(gainVal, this.ctx.currentTime + 0.02);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + dur + 0.02);
  }

  start() {
    if (this.playing) return;
    this.playing = true;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.ctx.resume();
    } catch { /* no audio available */ }

    const cycle = () => {
      if (this.loud) {
        // urgent two-tone siren, loud
        this.beep(880, 0.28, 0.9);
        setTimeout(() => this.beep(660, 0.28, 0.9), 300);
        vibrate([400, 120, 400]);
      } else {
        // gentle single chime
        this.beep(660, 0.16, 0.28);
        vibrate(120);
      }
    };
    cycle();
    // loud alarm repeats fast & relentlessly; soft one is a calm periodic chime
    this.timer = window.setInterval(cycle, this.loud ? 900 : 4000);
  }

  stop() {
    this.playing = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.vibTimer) { clearInterval(this.vibTimer); this.vibTimer = null; }
    try { navigator.vibrate?.(0); } catch { /* ignore */ }
    try { this.ctx?.close(); } catch { /* ignore */ }
    this.ctx = null;
  }
}
