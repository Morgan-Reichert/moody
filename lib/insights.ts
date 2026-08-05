// Mood correlations — reads existing data and surfaces what seems to lift (or lower) the mood.
import { getEntries, dosesForDate, isMedTaken, getWaterHistory } from "./storage";

export interface MoodInsight {
  key: string;
  text: string;
  direction: "positive" | "negative";
  delta: number;   // mood-point gap between high-factor and low-factor days
  sample: number;  // days considered
}

interface DayAgg { mood: number; sleep?: number; sport?: number; energy?: number; water?: number; adherence?: number; }

function avg(a: number[]): number | null { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; }
function sum(a: number[]): number { return a.reduce((x, y) => x + y, 0); }
function r1(n: number) { return Math.round(n * 10) / 10; }

function adherenceFor(date: string): number | undefined {
  const doses = dosesForDate(date);
  if (!doses.length) return undefined;
  const taken = doses.filter((d) => isMedTaken(date, d.medId, d.time)).length;
  return taken / doses.length;
}

/** Returns the factors that visibly track with the mood, strongest first. */
export function moodInsights(minDays = 6): MoodInsight[] {
  const byDate = new Map<string, { moods: number[]; sleep: number[]; sport: number[]; energy: number[] }>();
  for (const e of getEntries()) {
    if (!byDate.has(e.date)) byDate.set(e.date, { moods: [], sleep: [], sport: [], energy: [] });
    const d = byDate.get(e.date)!;
    d.moods.push(e.mood);
    if (e.sleep != null) d.sleep.push(e.sleep);
    if (e.sport != null) d.sport.push(e.sport);
    if (e.energy != null) d.energy.push(e.energy);
  }
  const water = getWaterHistory();
  const days: { date: string; agg: DayAgg }[] = [];
  byDate.forEach((d, date) => {
    const mood = avg(d.moods);
    if (mood == null) return;
    days.push({
      date,
      agg: {
        mood,
        sleep: avg(d.sleep) ?? undefined,
        sport: d.sport.length ? sum(d.sport) : undefined,
        energy: avg(d.energy) ?? undefined,
        water: water[date] != null ? water[date] : undefined,
        adherence: adherenceFor(date),
      },
    });
  });

  const factors: { key: keyof DayAgg; pos: string; neg: string }[] = [
    { key: "sleep", pos: "Tu vas mieux les jours où tu dors davantage", neg: "Ton humeur baisse quand tu manques de sommeil" },
    { key: "sport", pos: "Le sport tire ton humeur vers le haut", neg: "Les jours sans activité, ton moral est plus bas" },
    { key: "water", pos: "Bien t'hydrater semble aider ton moral", neg: "Les jours où tu bois peu, ton humeur est plus basse" },
    { key: "energy", pos: "Ton humeur suit ton niveau d'énergie", neg: "Quand ton énergie chute, ton humeur suit" },
    { key: "adherence", pos: "Prendre tes médicaments régulièrement soutient ton humeur", neg: "Les jours d'oubli de médicaments, ton humeur est plus basse" },
  ];

  const out: MoodInsight[] = [];
  for (const f of factors) {
    const rows = days.filter((d) => d.agg[f.key] != null);
    if (rows.length < minDays) continue;
    const sorted = rows.slice().sort((a, b) => (a.agg[f.key] as number) - (b.agg[f.key] as number));
    const half = Math.floor(sorted.length / 2);
    if (half < 2) continue;
    const lowMood = avg(sorted.slice(0, half).map((d) => d.agg.mood))!;
    const highMood = avg(sorted.slice(sorted.length - half).map((d) => d.agg.mood))!;
    const delta = r1(highMood - lowMood);
    if (Math.abs(delta) < 0.4) continue;
    const positive = delta > 0;
    out.push({ key: f.key as string, text: positive ? f.pos : f.neg, direction: positive ? "positive" : "negative", delta: Math.abs(delta), sample: rows.length });
  }
  return out.sort((a, b) => b.delta - a.delta);
}
