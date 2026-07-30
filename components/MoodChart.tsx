"use client";

import { Area, AreaChart, ResponsiveContainer, YAxis, Tooltip } from "recharts";

export function MoodChart({ data }: { data: { date: string; value: number | null }[] }) {
  const pts = data.map((d) => ({
    label: new Date(d.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
    value: d.value,
  }));
  const has = pts.some((p) => p.value != null);

  if (!has) {
    return (
      <div className="h-24 grid place-items-center text-sm text-ink-mute">
        Note ton humeur quelques jours pour voir ta courbe.
      </div>
    );
  }

  return (
    <div className="h-28 -mx-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={pts} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
          <defs>
            <linearGradient id="moodfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1aad55" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#1aad55" stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis domain={[1, 10]} hide />
          <Tooltip
            cursor={{ stroke: "#1aad55", strokeOpacity: 0.25 }}
            contentStyle={{ borderRadius: 14, border: "none", boxShadow: "0 8px 24px -8px rgba(20,50,35,.3)", fontSize: 12, fontFamily: "var(--font-body)" }}
            labelStyle={{ color: "#8a978f", fontWeight: 700 }}
            formatter={(v: number) => [`${v}/10`, "Humeur"]}
          />
          <Area
            type="monotone" dataKey="value" connectNulls
            stroke="#128a43" strokeWidth={2.6}
            fill="url(#moodfill)" dot={false}
            activeDot={{ r: 4, fill: "#128a43", stroke: "#fff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
