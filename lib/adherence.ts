// Medication adherence — how many scheduled doses were actually taken over a period.
import { getMeds, dosesForDate, isMedTaken } from "./storage";

export interface MedAdherence { medId: string; name: string; scheduled: number; taken: number; pct: number; }
export interface AdherenceStat {
  days: number;
  scheduled: number;   // doses whose time has passed
  taken: number;
  pct: number;
  perMed: MedAdherence[];
  perfectDays: number; // days where every due dose was taken
}

/** Adherence over the last `days` days (today counts only doses already due). */
export function adherenceStats(days: number, now = new Date()): AdherenceStat {
  const meds = getMeds();
  const medName = new Map(meds.map((m) => [m.id, m.name]));
  let scheduled = 0, taken = 0, perfectDays = 0;
  const per = new Map<string, { scheduled: number; taken: number }>();

  for (let i = 0; i < days; i++) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    let daySched = 0, dayTaken = 0;
    for (const dose of dosesForDate(date)) {
      const due = new Date(`${date}T${dose.time}:00`).getTime();
      if (due > now.getTime()) continue;               // not due yet (today's later doses)
      daySched++;
      const t = isMedTaken(date, dose.medId, dose.time);
      if (t) dayTaken++;
      const p = per.get(dose.medId) ?? { scheduled: 0, taken: 0 };
      p.scheduled++; if (t) p.taken++; per.set(dose.medId, p);
    }
    scheduled += daySched; taken += dayTaken;
    if (daySched > 0 && dayTaken === daySched) perfectDays++;
  }

  const perMed: MedAdherence[] = [];
  per.forEach((v, medId) => perMed.push({
    medId, name: medName.get(medId) ?? "Médicament",
    scheduled: v.scheduled, taken: v.taken,
    pct: v.scheduled ? Math.round((v.taken / v.scheduled) * 100) : 0,
  }));
  perMed.sort((a, b) => a.pct - b.pct);

  return { days, scheduled, taken, pct: scheduled ? Math.round((taken / scheduled) * 100) : 0, perMed, perfectDays };
}
