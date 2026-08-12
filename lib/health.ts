// Apple Health (HealthKit) sync — reads sleep / activity / resting HR.
// Garmin Connect and Coros write their data into Apple Health, so this one
// integration covers both watches (plus Apple Watch, Fitbit, etc.).
import { Capacitor } from "@capacitor/core";

const K_HEALTH = "moody_health";
const READ = ["sleepAnalysis", "stepCount", "activeEnergyBurned", "appleExerciseTime", "restingHeartRate"];

export interface HealthSnapshot {
  date: string;         // YYYY-MM-DD
  updated: string;      // ISO
  sleepHours: number | null;
  steps: number | null;
  activeKcal: number | null;
  exerciseMin: number | null;
  restingHR: number | null;   // bpm — proxy for stress / recovery
}

const isNative = () => { try { return Capacitor.isNativePlatform(); } catch { return false; } };
export const healthAvailable = () => isNative();

async function hk() { const { CapacitorHealthkit } = await import("@perfood/capacitor-healthkit"); return CapacitorHealthkit as any; }

/** Opens the iOS Health permission sheet for the data we read. */
export async function requestHealthAuth(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const p = await hk();
    await p.isAvailable();
    await p.requestAuthorization({ all: [], read: READ, write: [] });
    return true;
  } catch { return false; }
}

async function query(sampleName: string, start: Date, end: Date, limit = 0): Promise<any[]> {
  try {
    const p = await hk();
    const out = await p.queryHKitSampleType({ sampleName, startDate: start.toISOString(), endDate: end.toISOString(), limit });
    return out?.resultData ?? [];
  } catch { return []; }
}
const sum = (arr: any[]) => arr.reduce((a, s) => a + (s.value || 0), 0);

/** Reads today's health numbers from Apple Health and caches a snapshot. */
export async function syncHealth(): Promise<HealthSnapshot | null> {
  if (!isNative()) return null;
  try {
    const now = new Date();
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);

    // Sleep: last night (from ~18h ago) — sum "asleep" durations, fall back to "in bed".
    const sleep = await query("sleepAnalysis", new Date(now.getTime() - 18 * 3600e3), now, 0);
    let sleepSec = sleep.filter((s) => /asleep/i.test(s.sleepState || "")).reduce((a, s) => a + (s.duration || 0), 0);
    if (sleepSec === 0) sleepSec = sleep.filter((s) => /inbed|in_bed/i.test(s.sleepState || "")).reduce((a, s) => a + (s.duration || 0), 0);

    const steps = sum(await query("stepCount", dayStart, now, 0));
    const activeKcal = sum(await query("activeEnergyBurned", dayStart, now, 0));
    const exerciseMin = sum(await query("appleExerciseTime", dayStart, now, 0));
    const rhr = await query("restingHeartRate", new Date(now.getTime() - 3 * 864e5), now, 0);

    const snap: HealthSnapshot = {
      date: now.toISOString().slice(0, 10),
      updated: now.toISOString(),
      sleepHours: sleepSec > 0 ? Math.round((sleepSec / 3600) * 10) / 10 : null,
      steps: steps > 0 ? Math.round(steps) : null,
      activeKcal: activeKcal > 0 ? Math.round(activeKcal) : null,
      exerciseMin: exerciseMin > 0 ? Math.round(exerciseMin) : null,
      restingHR: rhr.length ? Math.round(rhr[rhr.length - 1].value) : null,
    };
    try { localStorage.setItem(K_HEALTH, JSON.stringify(snap)); window.dispatchEvent(new Event("moody:health")); } catch { /* */ }
    return snap;
  } catch { return null; }
}

export function getHealthSnapshot(): HealthSnapshot | null {
  try { const v = localStorage.getItem(K_HEALTH); return v ? JSON.parse(v) : null; } catch { return null; }
}
