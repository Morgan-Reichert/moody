// Pushes a compact summary to the shared App Group so the iOS home-screen widget can read it.
import { Capacitor } from "@capacitor/core";
import { getTodayEntries, moodLabel, getBrushToday, BRUSH_GOAL, getWaterToday, getSettings } from "./storage";
import { todayMedStatus } from "./reminders";
import { adherenceStats } from "./adherence";

export const WIDGET_GROUP = "group.tech.stariax.moodyapp";
export const WIDGET_KEY = "moody_widget";

export interface WidgetData {
  updated: string;
  mood: number | null;
  moodLabel: string;
  medLabel: string;
  medState: "done" | "overdue" | "next" | "none";
  adherence: number;     // last 7 days %, -1 if no data
  brush: string;         // "1/2"
  water: string;         // "0,50 L"
}

function buildPayload(): WidgetData {
  const today = getTodayEntries();
  const moodAvg = today.length ? today.reduce((a, e) => a + e.mood, 0) / today.length : null;

  const s = todayMedStatus(new Date());
  let medLabel = "Aucun médicament", medState: WidgetData["medState"] = "none";
  if (s.total > 0) {
    if (s.allTaken) { medLabel = "Tout est pris"; medState = "done"; }
    else if (s.overdue) { medLabel = `${s.overdue.dose.name} en retard`; medState = "overdue"; }
    else if (s.next) { medLabel = `${s.next.dose.name} à ${s.next.dose.time}`; medState = "next"; }
    else { medLabel = `${s.takenCount}/${s.total} pris`; medState = "next"; }
  }

  const adh = adherenceStats(7);
  const settings = getSettings();
  const cl = getWaterToday();

  return {
    updated: new Date().toISOString(),
    mood: moodAvg != null ? Math.round(moodAvg * 10) / 10 : null,
    moodLabel: moodAvg != null ? moodLabel(moodAvg) : "Pas encore noté",
    medLabel, medState,
    adherence: adh.scheduled ? adh.pct : -1,
    brush: settings.modules.includes("brushing") ? `${getBrushToday()}/${BRUSH_GOAL}` : "",
    water: settings.modules.includes("water") ? `${(cl / 100).toFixed(2).replace(".", ",")} L` : "",
  };
}

/** Write the current summary to the App Group and refresh the widgets (native only). */
export async function pushWidgetData(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { WidgetsBridgePlugin } = await import("capacitor-widgetsbridge-plugin");
    await WidgetsBridgePlugin.setItem({ key: WIDGET_KEY, value: JSON.stringify(buildPayload()), group: WIDGET_GROUP });
    await WidgetsBridgePlugin.reloadAllTimelines();
  } catch { /* widget not set up yet — ignore */ }
}
