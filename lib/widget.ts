// Pushes a compact summary to the shared App Group so the iOS home-screen widgets can read it.
import { Capacitor } from "@capacitor/core";
import { getTodayEntries, moodLabel, streak } from "./storage";
import { todayMedStatus, fmtDuration } from "./reminders";
import { adherenceStats } from "./adherence";
import { tipOfDay } from "./tips";

export const WIDGET_GROUP = "group.tech.stariax.moodyapp";
export const WIDGET_KEY = "moody_widget";

export interface WidgetData {
  updated: string;
  mood: number | null;
  moodLabel: string;
  moodStreak: number;
  medStatus: "none" | "done" | "overdue" | "next";
  medPrimary: string;    // main line, e.g. "Doliprane" / "Tout est pris"
  medSecondary: string;  // e.g. "à 20:00" / "en retard de 15 min"
  medTaken: number;
  medTotal: number;
  adherence: number;     // last 7 days %, -1 if no data
  tip: string;           // wellbeing tip (evening tips after 20h)
  tipEvening: boolean;
}

function buildPayload(): WidgetData {
  const today = getTodayEntries();
  const moodAvg = today.length ? today.reduce((a, e) => a + e.mood, 0) / today.length : null;

  const s = todayMedStatus(new Date());
  let medStatus: WidgetData["medStatus"] = "none", medPrimary = "Aucun médicament", medSecondary = "";
  if (s.total > 0) {
    if (s.allTaken) { medStatus = "done"; medPrimary = "Tout est pris"; medSecondary = `${s.total}/${s.total} aujourd'hui`; }
    else if (s.overdue) { medStatus = "overdue"; medPrimary = s.overdue.dose.name; medSecondary = `en retard de ${fmtDuration(s.overdue.msLate)}`; }
    else if (s.next) { medStatus = "next"; medPrimary = s.next.dose.name; medSecondary = `à ${s.next.dose.time}`; }
    else { medStatus = "next"; medPrimary = `${s.takenCount}/${s.total} pris`; medSecondary = ""; }
  }

  const adh = adherenceStats(7);
  const tip = tipOfDay();

  return {
    updated: new Date().toISOString(),
    mood: moodAvg != null ? Math.round(moodAvg * 10) / 10 : null,
    moodLabel: moodAvg != null ? moodLabel(moodAvg) : "Pas encore noté",
    moodStreak: streak(),
    medStatus, medPrimary, medSecondary,
    medTaken: s.takenCount, medTotal: s.total,
    adherence: adh.scheduled ? adh.pct : -1,
    tip: tip.text, tipEvening: tip.evening,
  };
}

/** Write the current summary to the App Group and refresh the widgets (native only). */
export async function pushWidgetData(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { WidgetsBridgePlugin } = await import("capacitor-widgetsbridge-plugin");
    await WidgetsBridgePlugin.setItem({ key: WIDGET_KEY, value: JSON.stringify(buildPayload()), group: WIDGET_GROUP });
    await WidgetsBridgePlugin.reloadAllTimelines();
  } catch { /* widgets not set up yet — ignore */ }
}
