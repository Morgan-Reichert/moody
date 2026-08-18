"use client";

import { Area, AreaChart, ResponsiveContainer, YAxis, Tooltip } from "recharts";
import { Sprout } from "lucide-react";

export function MoodChart({ data }: { data: { date: string; value: number | null }[] }) {
  const pts = data.map((d) => ({
    label: new Date(d.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
    value: d.value,
  }));
  const has = pts.some((p) => p.value != null);

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
