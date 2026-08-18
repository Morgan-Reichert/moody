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

  if (!has) {
    return (
      <div className="min-h-24 flex flex-col items-center justify-center text-center gap-2 py-5 px-3">
        <span className="grid place-items-center h-11 w-11 rounded-2xl bg-cream text-brand-600"><Sprout className="h-6 w-6" /></span>
        <p className="text-[14px] font-bold text-ink">Ta courbe se dessine ici</p>
        <p className="text-[12.5px] text-ink-mute max-w-[240px]">Note ton humeur quelques jours de suite — persévère, et tu verras tes tendances apparaître.</p>
      </div>
    );
  }

  return (
    <div className="h-28 -mx-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={pts} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
          <defs>
            <linearGradient id="moodfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#477bff" stopOpacity={0.30} />
              <stop offset="100%" stopColor="#477bff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis domain={[1, 10]} hide />
          <Tooltip
            cursor={{ stroke: "#477bff", strokeOpacity: 0.25 }}
            contentStyle={{ borderRadius: 14, border: "none", boxShadow: "0 8px 24px -8px rgba(22,26,40,.25)", fontSize: 12, fontFamily: "var(--font-body)" }}
            labelStyle={{ color: "#989ca6", fontWeight: 700 }}
            formatter={(v: number) => [`${v}/10`, "Humeur"]}
          />
          <Area
            type="monotone" dataKey="value" connectNulls
            stroke="#477bff" strokeWidth={2.6}
            fill="url(#moodfill)" dot={false}
            activeDot={{ r: 4, fill: "#477bff", stroke: "#fff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
