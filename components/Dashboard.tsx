"use client";

import { useEffect, useMemo, useState } from "react";
import {
  onChange, getTodayEntries, average, streak, dailySeries,
  getMeds, getSettings, moodLabel,
} from "@/lib/storage";
import { nextReminders } from "@/lib/reminders";
import { MoodChart } from "@/components/MoodChart";
import { RemindersSettings } from "@/components/RemindersSettings";
import { Flame, Sparkles, TrendingUp, Bell, Pill, Smile, ChevronRight, Settings2 } from "lucide-react";

function Ring({ value }: { value: number | null }) {
  const pct = value != null ? Math.max(4, (value / 10) * 100) : 0;
  return (
    <div
      className="relative h-[86px] w-[86px] rounded-full grid place-items-center shrink-0"
      style={{ background: `conic-gradient(#1aad55 ${pct}%, rgba(18,138,67,.12) 0)` }}
    >
      <div className="absolute inset-[7px] rounded-full bg-white grid place-items-center">
        <span className="font-display text-[26px] leading-none text-ink font-semibold">
          {value != null ? value.toFixed(1) : "—"}
        </span>
      </div>
    </div>
  );
}

function useVersion() {
  const [, set] = useState(0);
  useEffect(() => onChange(() => set((v) => v + 1)), []);
}

export function Dashboard({ mounted, onLogMood }: { mounted: boolean; onLogMood: () => void }) {
  useVersion();
  const [showSettings, setShowSettings] = useState(false);

  const today = useMemo(() => (mounted ? getTodayEntries() : []), [mounted]);
  const avg7 = useMemo(() => (mounted ? average(7) : null), [mounted]);
  const strk = useMemo(() => (mounted ? streak() : 0), [mounted]);
  const series = useMemo(() => (mounted ? dailySeries(14) : []), [mounted]);
  const meds = useMemo(() => (mounted ? getMeds() : []), [mounted]);
  const settings = useMemo(() => (mounted ? getSettings() : null), [mounted]);

  const todayAvg = today.length ? today.reduce((a, e) => a + e.mood, 0) / today.length : null;
  const reminders = settings ? nextReminders(settings, meds).filter((r) => r.upcoming).slice(0, 3) : [];

  const now = new Date();
  const dateLabel = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const hour = now.getHours();
  const hello = hour < 6 ? "Bonne nuit" : hour < 12 ? "Bonjour" : hour < 18 ? "Bel après-midi" : "Bonsoir";

  return (
    <div className="min-h-full px-5 pt-safe pb-6">
      <div className="max-w-md mx-auto stagger">
        {/* Header */}
        <header className="flex items-center justify-between pt-3 pb-1">
          <img src="./brand/moody-wordmark.png" alt="Moody" className="h-7 w-auto" />
          <button
            onClick={() => setShowSettings(true)}
            className="grid place-items-center h-11 w-11 rounded-2xl bg-white shadow-card text-ink-soft active:scale-95 transition"
            aria-label="Réglages des rappels"
          >
            <Settings2 className="h-5 w-5" strokeWidth={2.2} />
          </button>
        </header>

        <div className="mt-3 mb-4">
          <p className="text-sm text-ink-mute capitalize">{dateLabel}</p>
          <h1 className="font-display text-[28px] font-semibold text-ink leading-tight">{hello}.</h1>
        </div>

        {/* Mood today hero */}
        <section className="rounded-4xl p-5 bg-mint flex items-center gap-4 shadow-soft">
          <Ring value={todayAvg} />
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-widest uppercase text-brand-700/70">Humeur du jour</p>
            {todayAvg != null ? (
              <>
                <p className="font-display text-xl font-semibold text-ink mt-0.5">{moodLabel(todayAvg)}</p>
                <p className="text-[13px] text-ink-soft mt-0.5">
                  {today.length} saisie{today.length > 1 ? "s" : ""} aujourd'hui
                </p>
              </>
            ) : (
              <>
                <p className="font-display text-xl font-semibold text-ink mt-0.5">Pas encore noté</p>
                <button onClick={onLogMood} className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-brand-700">
                  Noter maintenant <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-3 gap-3 mt-3">
          <Stat icon={<TrendingUp className="h-[18px] w-[18px]" />} value={avg7 != null ? avg7.toFixed(1) : "—"} label="Moy. 7 j" />
          <Stat icon={<Flame className="h-[18px] w-[18px]" />} value={String(strk)} label={strk > 1 ? "jours de série" : "jour de série"} />
          <Stat icon={<Sparkles className="h-[18px] w-[18px]" />} value={String(today.length)} label="aujourd'hui" />
        </section>

        {/* Reminders */}
        <section className="mt-6">
          <div className="flex items-center justify-between mb-2.5 px-1">
            <h2 className="font-display text-[17px] font-semibold text-ink">Prochains rappels</h2>
            <button onClick={() => setShowSettings(true)} className="text-[13px] font-bold text-brand-700">Gérer</button>
          </div>

          {reminders.length === 0 ? (
            <div className="card p-5 text-sm text-ink-mute flex items-center gap-3">
              <Bell className="h-5 w-5 text-ink-mute shrink-0" />
              Aucun rappel à venir aujourd'hui. Touche « Gérer » pour en ajouter.
            </div>
          ) : (
            <div className="space-y-2.5">
              {reminders.map((r, i) => (
                <div key={i} className="card p-3.5 flex items-center gap-3.5">
                  <span className={`grid place-items-center h-11 w-11 rounded-2xl text-white shrink-0 ${r.kind === "mood" ? "bg-brand-500" : "bg-[#e78a4b]"}`}>
                    {r.kind === "mood" ? <Smile className="h-[22px] w-[22px]" /> : <Pill className="h-[22px] w-[22px]" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-ink text-[15px] truncate">{r.label}</p>
                    <p className="text-[12.5px] text-ink-mute truncate">{r.sub}</p>
                  </div>
                  <span className="font-display font-semibold text-ink tabular-nums">{r.time}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Chart */}
        <section className="card p-4 mt-6">
          <div className="flex items-center justify-between px-1 mb-1">
            <h2 className="font-display text-[16px] font-semibold text-ink">Humeur — 14 jours</h2>
          </div>
          <MoodChart data={series} />
        </section>
      </div>

      {showSettings && <RemindersSettings onClose={() => setShowSettings(false)} />}
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="card p-3.5 flex flex-col gap-1.5">
      <span className="text-brand-600">{icon}</span>
      <span className="font-display text-xl font-semibold text-ink leading-none">{value}</span>
      <span className="text-[11px] text-ink-mute font-semibold leading-tight">{label}</span>
    </div>
  );
}
