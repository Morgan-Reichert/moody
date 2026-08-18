import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { getSettings, getMeds, getAppointments, getDoctors, brushSlots } from "./storage";
import { randomEveningTip } from "./tips";

export function isNative(): boolean {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
}

/** Ask permission + create Android channels. Call once on launch. */
export async function initNative(): Promise<void> {
  if (!isNative()) return;
  try { await LocalNotifications.requestPermissions(); } catch { /* */ }
  try {
    await LocalNotifications.createChannel({ id: "moody-meds", name: "Médicaments", description: "Rappels de prise", importance: 5, vibration: true, visibility: 1 });
    await LocalNotifications.createChannel({ id: "moody-meds-loud", name: "Médicaments (alarme forte)", description: "Alarme sonore de prise", importance: 5, sound: "alarm.wav", vibration: true, visibility: 1 });
    await LocalNotifications.createChannel({ id: "moody-mood", name: "Humeur & rendez-vous", description: "Rappels d'humeur et RDV", importance: 4, vibration: true, visibility: 1 });
  } catch { /* */ }
}

function idFor(s: string): number {
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 2000000000;
}

/** Reschedule all OS notifications from current data (idempotent). */
export async function syncNative(): Promise<void> {
  if (!isNative()) return;
  const settings = getSettings(), meds = getMeds(), appts = getAppointments(), doctors = getDoctors();
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  } catch { /* */ }

  const notifs: any[] = [];
  const everyday = [0, 1, 2, 3, 4, 5, 6];

  for (const slot of settings.moodSlots) {
    const [h, m] = slot.time.split(":").map(Number);
    for (const d of (slot.days.length ? slot.days : everyday)) {
      notifs.push({ id: idFor(`mood-${slot.time}-${d}`), title: "Comment te sens-tu ?", body: "C'est l'heure de noter ton humeur.", channelId: "moody-mood", schedule: { on: { weekday: d + 1, hour: h, minute: m }, repeats: true, allowWhileIdle: true } });
    }
  }
  if (settings.modules.includes("brushing")) {
    for (const slot of brushSlots()) {
      const [h, m] = slot.time.split(":").map(Number);
      for (const d of (slot.days.length ? slot.days : everyday)) {
        notifs.push({ id: idFor(`brush-${slot.time}-${d}`), title: "Brossage des dents", body: "C'est l'heure de te brosser les dents.", channelId: "moody-mood", schedule: { on: { weekday: d + 1, hour: h, minute: m }, repeats: true, allowWhileIdle: true } });
      }
    }
  }

  if (settings.bedtimeEnabled) {
    const [h, m] = (settings.bedtimeTime || "22:00").split(":").map(Number);
    for (const d of everyday) {
      notifs.push({ id: idFor(`bedtime-${d}`), title: "On ralentit ? 🌙", body: randomEveningTip(new Date()), channelId: "moody-mood", schedule: { on: { weekday: d + 1, hour: h, minute: m }, repeats: true, allowWhileIdle: true } });
    }
  }

  const loud = !!settings.loudAlarm;
  for (const med of meds) {
    for (const slot of med.slots) {
      const [h, m] = slot.time.split(":").map(Number);
      for (const d of (slot.days.length ? slot.days : everyday)) {
        notifs.push({
          id: idFor(`med-${med.id}-${slot.time}-${d}`),
          title: `Médicament — ${med.name}`,
          body: med.dose ? `Il est temps de prendre ${med.name} (${med.dose}).` : `Il est temps de prendre ${med.name}.`,
          channelId: loud ? "moody-meds-loud" : "moody-meds",
          ...(loud ? { sound: "alarm.wav" } : {}),
          extra: { kind: "med", medId: med.id },
          schedule: { on: { weekday: d + 1, hour: h, minute: m }, repeats: true, allowWhileIdle: true },
        });
      }
    }
  }
  const offsets = [1440, 720, 60, 15];
  for (const a of appts) {
    const t = new Date(a.datetime).getTime();
    const doc = a.doctorId ? doctors.find((d) => d.id === a.doctorId) : undefined;
    for (const off of offsets) {
      const at = new Date(t - off * 60000);
      if (at.getTime() > Date.now()) {
        notifs.push({ id: idFor(`appt-${a.id}-${off}`), title: `Rendez-vous dans ${off >= 60 ? off / 60 + " h" : off + " min"}`, body: `${a.title}${doc ? ` — ${doc.name}` : ""}${a.address ? ` · ${a.address}` : ""}`, channelId: "moody-mood", schedule: { at, allowWhileIdle: true } });
      }
    }
  }

  try { if (notifs.length) await LocalNotifications.schedule({ notifications: notifs.slice(0, 480) }); } catch { /* */ }
}
