"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, YAxis, XAxis, Tooltip, ReferenceLine, ReferenceDot } from "recharts";
import { Sprout, TrendingUp, TrendingDown, Minus, X } from "lucide-react";
import { useStore, dailySeries, getEntries, moodLabel, ENERGY_LABELS, APPETITE_LABELS, MoodEntry } from "@/lib/storage";
import { Portal } from "@/components/Portal";

const RANGES = [7, 14, 30, 90] as const;

function moodColor(v: number): string {
  if (v >= 7) return "#1aad55";      // green
  if (v >= 5) return "#d8a72f";      // amber
  return "#d0492c";                  // red
}
function avg(a: number[]): number | null { return a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : null; }

export function MoodChart() {
  const v = useStore();
  const [range, setRange] = useState<(typeof RANGES)[number]>(14);
  const [mounted, setMounted] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  useEffect(() => setMounted(true), []);

  const series = mounted ? dailySeries(range) : [];
  const pts = series.map((d) => ({
    date: d.date,
    label: new Date(d.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
    value: d.value,
  }));
  const real = pts.filter((p) => p.value != null) as { date: string; label: string; value: number }[];
  const has = real.length > 0;
  // Start the curve at the first logged day so long ranges (30/90 j) have no empty gap on the left.
  const firstIdx = pts.findIndex((p) => p.value != null);
  const chartPts = firstIdx > 0 ? pts.slice(firstIdx) : pts;

  const mean = avg(real.map((p) => p.value));
  // trend: first half vs second half average
  const h = Math.floor(real.length / 2);
  const firstAvg = h >= 1 ? avg(real.slice(0, h).map((p) => p.value)) : null;
  const secondAvg = h >= 1 ? avg(real.slice(real.length - h).map((p) => p.value)) : null;
  const trendDelta = firstAvg != null && secondAvg != null ? Math.round((secondAvg - firstAvg) * 10) / 10 : null;

  let best = real[0], worst = real[0];
  for (const p of real) { if (p.value > best.value) best = p; if (p.value < worst.value) worst = p; }

  const showDots = has && range <= 14;

  return (
    <div>
      {/* range selector */}
      <div className="flex items-center justify-between mb-2 px-0.5">
        <div className="flex bg-black/[0.04] rounded-full p-0.5">
          {RANGES.map((r) => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-2.5 py-1 rounded-full text-[11.5px] font-bold transition ${range === r ? "bg-white shadow-card text-ink" : "text-ink-mute"}`}>{r} j</button>
          ))}
        </div>
        {trendDelta != null && Math.abs(trendDelta) >= 0.3 ? (
          <span className={`inline-flex items-center gap-1 text-[12px] font-bold ${trendDelta > 0 ? "text-brand-700" : "text-[#c0402a]"}`}>
            {trendDelta > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {trendDelta > 0 ? "en hausse" : "en baisse"}
          </span>
        ) : has ? (
          <span className="inline-flex items-center gap-1 text-[12px] font-bold text-ink-mute"><Minus className="h-4 w-4" /> stable</span>
        ) : null}
      </div>

      {!has ? (
        <div className="min-h-24 flex flex-col items-center justify-center text-center gap-2 py-5 px-3">
          <span className="grid place-items-center h-11 w-11 rounded-2xl bg-brand-50 text-brand-600"><Sprout className="h-6 w-6" /></span>
          <p className="text-[14px] font-bold text-ink">Ta courbe se dessine ici</p>
          <p className="text-[12.5px] text-ink-mute max-w-[240px]">Note ton humeur quelques jours de suite — persévère, et tu verras tes tendances apparaître.</p>
        </div>
      ) : (
        <>
          <div className="h-36 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartPts} margin={{ top: 10, right: 8, bottom: 0, left: 8 }}
                onClick={(e: any) => { const i = e?.activeTooltipIndex; if (i != null && chartPts[i]?.value != null) setDay(chartPts[i].date); }}>
                <defs>
                  <linearGradient id="moodfill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1aad55" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="#1aad55" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis domain={[1, 10]} hide />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#8a978f" }} axisLine={false} tickLine={false} minTickGap={24} interval="preserveStartEnd" />
                {mean != null && (
                  <ReferenceLine y={mean} stroke="#8a978f" strokeDasharray="4 4" strokeOpacity={0.7}
                    label={{ value: `moy ${mean}`, position: "insideTopRight", fontSize: 10, fill: "#8a978f", fontWeight: 700 }} />
                )}
                <Tooltip
                  cursor={{ stroke: "#1aad55", strokeOpacity: 0.25 }}
                  contentStyle={{ borderRadius: 14, border: "none", boxShadow: "0 8px 24px -8px rgba(20,50,35,.3)", fontSize: 12, fontFamily: "var(--font-body)" }}
                  labelStyle={{ color: "#8a978f", fontWeight: 700 }}
                  formatter={(val: number) => [`${val}/10 · ${moodLabel(val)}`, "Humeur"]}
                />
                <Area
                  type="monotone" dataKey="value" connectNulls
                  stroke="#128a43" strokeWidth={2.6}
                  fill="url(#moodfill)"
                  dot={showDots ? (p: any) => (p.payload.value == null ? <g key={p.key} /> : <circle key={p.key} cx={p.cx} cy={p.cy} r={3.4} fill={moodColor(p.payload.value)} stroke="#fff" strokeWidth={1.6} />) : false}
                  activeDot={{ r: 5, fill: "#128a43", stroke: "#fff", strokeWidth: 2 }}
                />
                {/* best / worst markers */}
                {real.length > 2 && best && (
                  <ReferenceDot x={best.label} y={best.value} r={5} fill="#1aad55" stroke="#fff" strokeWidth={2}
                    label={{ value: `↑${best.value}`, position: "top", fontSize: 10, fill: "#128a43", fontWeight: 700 }} />
                )}
                {real.length > 2 && worst && worst.date !== best.date && (
                  <ReferenceDot x={worst.label} y={worst.value} r={5} fill="#d0492c" stroke="#fff" strokeWidth={2}
                    label={{ value: `↓${worst.value}`, position: "bottom", fontSize: 10, fill: "#c0402a", fontWeight: 700 }} />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-ink-mute text-center mt-1">Touche un point pour voir le détail du jour</p>
        </>
      )}

      {day && <DayDetail date={day} onClose={() => setDay(null)} />}
    </div>
  );
}

function DayDetail({ date, onClose }: { date: string; onClose: () => void }) {
  useStore();
  const entries = getEntries().filter((e) => e.date === date);
  const dLabel = new Date(date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const dayAvg = entries.length ? Math.round((entries.reduce((a, e) => a + e.mood, 0) / entries.length) * 10) / 10 : null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[70] flex flex-col justify-end" role="dialog" aria-modal="true">
        <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-cream rounded-t-4xl max-h-[80vh] overflow-y-auto overscroll-none animate-sheetUp pb-safe">
          <div className="sticky top-0 bg-cream/95 backdrop-blur px-5 pt-3 pb-3 z-10">
            <div className="mx-auto h-1.5 w-10 rounded-full bg-black/10 mb-3" />
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink capitalize">{dLabel}</h2>
                {dayAvg != null && <p className="text-[13px] font-semibold" style={{ color: moodColor(dayAvg) }}>{dayAvg}/10 · {moodLabel(dayAvg)}</p>}
              </div>
              <button onClick={onClose} className="grid place-items-center h-10 w-10 rounded-2xl bg-white shadow-card text-ink-soft active:scale-95"><X className="h-5 w-5" /></button>
            </div>
          </div>
          <div className="px-5 pb-8 pt-1 space-y-3">
            {entries.length === 0 && <p className="text-[13px] text-ink-mute">Aucune saisie ce jour.</p>}
            {entries.map((e) => <EntryCard key={e.id} e={e} />)}
          </div>
        </div>
      </div>
    </Portal>
  );
}

function EntryCard({ e }: { e: MoodEntry }) {
  const time = new Date(e.datetime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const chips: string[] = [];
  if (e.energy != null) chips.push(`Énergie : ${ENERGY_LABELS[e.energy - 1] ?? e.energy}`);
  if (e.appetite != null) chips.push(`Appétit : ${APPETITE_LABELS[e.appetite - 1] ?? e.appetite}`);
  if (e.sleep != null) chips.push(`Sommeil : ${e.sleep} h`);
  if (e.sport != null) chips.push(`Sport : ${e.sport} min`);
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="font-display text-2xl font-semibold" style={{ color: moodColor(e.mood) }}>{e.mood}</span>
        <span className="text-[13px] font-semibold text-ink">{moodLabel(e.mood)}</span>
        <span className="ml-auto text-[12px] text-ink-mute tabular-nums">{time}</span>
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {chips.map((c) => <span key={c} className="text-[11.5px] font-semibold text-ink-soft bg-black/[0.04] rounded-full px-2.5 py-1">{c}</span>)}
        </div>
      )}
      {e.symptoms && e.symptoms.length > 0 && (
        <p className="text-[12.5px] text-[#c0402a] font-semibold">Symptômes : {e.symptoms.join(", ")}{e.symptomIntensity ? ` (intensité ${e.symptomIntensity}/3)` : ""}</p>
      )}
      {e.note && <p className="text-[13.5px] text-ink-soft mt-1 leading-snug">“{e.note}”</p>}
    </div>
  );
}
