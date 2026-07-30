"use client";

import { useEffect, useState } from "react";
import {
  useStore, getTodayEntries, average, streak, dailySeries, moodLabel,
  getSettings, getMeds, todayISO, setMedTaken,
} from "@/lib/storage";
import { todayMedStatus, fmtDuration } from "@/lib/reminders";
import { MoodChart } from "@/components/MoodChart";
import { RemindersSettings } from "@/components/RemindersSettings";
import { ReportSheet } from "@/components/ReportSheet";
import { WaterCard, AddictionsSection } from "@/components/DashboardCards";
import { WeatherWidget } from "@/components/WeatherWidget";
import { SortableList, SortItem } from "@/components/SortableList";
import {
  Flame, Sparkles, TrendingUp, Pill, Smile, ChevronRight, Settings2,
  Check, Clock, AlertTriangle, FileText, CheckCircle2, Heart,
} from "lucide-react";

function Ring({ value }: { value: number | null }) {
  const pct = value != null ? Math.max(4, (value / 10) * 100) : 0;
  return (
    <div className="relative h-[86px] w-[86px] rounded-full grid place-items-center shrink-0"
      style={{ background: `conic-gradient(#1aad55 ${pct}%, rgba(18,138,67,.12) 0)` }}>
      <div className="absolute inset-[7px] rounded-full bg-white grid place-items-center">
        <span className="font-display text-[26px] leading-none text-ink font-semibold">{value != null ? value.toFixed(1) : "—"}</span>
      </div>
    </div>
  );
}

export function Dashboard({ mounted, onLogMood }: { mounted: boolean; onLogMood: () => void }) {
  useStore();
  const [showSettings, setShowSettings] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const today = mounted ? getTodayEntries() : [];
  const avg7 = mounted ? average(7) : null;
  const strk = mounted ? streak() : 0;
  const series = mounted ? dailySeries(14) : [];
  const meds = mounted ? getMeds() : [];
  const settings = mounted ? getSettings() : null;

  const todayAvg = today.length ? today.reduce((a, e) => a + e.mood, 0) / today.length : null;

  const now = new Date();
  const dateLabel = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const hour = now.getHours();
  const hello = hour < 6 ? "Douce nuit" : hour < 12 ? "Bonjour" : hour < 18 ? "Bel après-midi" : "Bonsoir";

  const cards: SortItem[] = [
    {
      key: "mood",
      node: (
        <section className="rounded-4xl p-5 bg-mint flex items-center gap-4 shadow-soft">
          <Ring value={todayAvg} />
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-widest uppercase text-brand-700/70">Ton humeur du jour</p>
            {todayAvg != null ? (
              <>
                <p className="font-display text-xl font-semibold text-ink mt-0.5">{moodLabel(todayAvg)}</p>
                <p className="text-[13px] text-ink-soft mt-0.5">{today.length} saisie{today.length > 1 ? "s" : ""} aujourd'hui</p>
              </>
            ) : (
              <>
                <p className="font-display text-xl font-semibold text-ink mt-0.5">Pas encore noté</p>
                <button onClick={onLogMood} className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-brand-700">Noter maintenant <ChevronRight className="h-4 w-4" /></button>
              </>
            )}
          </div>
        </section>
      ),
    },
    {
      key: "stats",
      node: (
        <section className="grid grid-cols-3 gap-3">
          <Stat icon={<TrendingUp className="h-[18px] w-[18px]" />} value={avg7 != null ? avg7.toFixed(1) : "—"} label="Moy. 7 j" />
          <Stat icon={<Flame className="h-[18px] w-[18px]" />} value={String(strk)} label={strk > 1 ? "jours de série" : "jour de série"} />
          <Stat icon={<Sparkles className="h-[18px] w-[18px]" />} value={String(today.length)} label="aujourd'hui" />
        </section>
      ),
    },
  ];
  if (mounted && meds.length > 0) cards.push({ key: "meds", node: <MedStatusCard onManage={() => setShowSettings(true)} /> });
  if (mounted && settings?.modules.includes("water")) cards.push({ key: "water", node: <WaterCard /> });
  if (mounted && settings?.modules.includes("addiction")) cards.push({ key: "addiction", node: <AddictionsSection onManage={() => setShowSettings(true)} /> });
  if (settings && settings.moodSlots.length > 0) cards.push({
    key: "reminder",
    node: (
      <button onClick={onLogMood} className="card w-full p-3.5 flex items-center gap-3.5 text-left">
        <span className="grid place-items-center h-11 w-11 rounded-2xl bg-brand-500 text-white shrink-0"><Smile className="h-[22px] w-[22px]" /></span>
        <div className="flex-1"><p className="font-bold text-ink text-[15px]">Rappels humeur</p><p className="text-[12.5px] text-ink-mute">{settings.moodSlots.map((s) => s.time).join(" · ")}</p></div>
        <ChevronRight className="h-5 w-5 text-ink-mute" />
      </button>
    ),
  });
  cards.push({
    key: "chart",
    node: (
      <section className="card p-4">
        <div className="flex items-center justify-between px-1 mb-1">
          <h2 className="font-display text-[16px] font-semibold text-ink">Ton humeur — 14 jours</h2>
          <button onClick={() => setShowReport(true)} className="text-[12.5px] font-bold text-brand-700">Rapport</button>
        </div>
        <MoodChart data={series} />
      </section>
    ),
  });

  return (
    <div className="min-h-full pb-6">
      {/* Sticky top bar — opaque at the very top, fading translucent downward */}
      <header className="sticky top-0 z-30 pt-safe px-5 pb-5 bg-gradient-to-b from-cream via-cream/90 to-transparent backdrop-blur-[6px]">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <img src="./brand/moody-wordmark-tight.png" alt="Moody" className="h-14 w-auto max-w-[58%]" />
          <div className="flex items-center gap-2">
            <button onClick={() => setShowReport(true)} className="grid place-items-center h-11 w-11 rounded-2xl bg-white shadow-card text-ink-soft active:scale-95 transition" aria-label="Rapport">
              <FileText className="h-5 w-5" strokeWidth={2.2} />
            </button>
            <button onClick={() => setShowSettings(true)} className="grid place-items-center h-11 w-11 rounded-2xl bg-white shadow-card text-ink-soft active:scale-95 transition" aria-label="Réglages">
              <Settings2 className="h-5 w-5" strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </header>

      <div className="px-5">
        <div className="max-w-md mx-auto stagger">
        <div className="mt-4 mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-ink-mute capitalize">{dateLabel}</p>
            <h1 className="font-display text-[27px] font-semibold text-ink leading-tight">{hello}{settings?.name ? `, ${settings.name}` : ""}.</h1>
            {settings?.mantra && <p className="text-[13px] text-brand-700 font-semibold mt-1 leading-snug">{settings.mantra}</p>}
          </div>
          {mounted && settings?.weather && <WeatherWidget />}
        </div>

        {/* Reorderable cards — long-press to rearrange */}
        <SortableList items={cards} />

        {/* Signature */}
        <div className="mt-6 flex items-center justify-center gap-1.5 text-[11.5px] text-ink-mute/80">
          <span>Édité par</span>
          <img src="./brand/stariax-wordmark.png" alt="Stariax" className="h-3.5 w-auto opacity-70" />
          <span>· fait avec</span>
          <Heart className="h-3 w-3 fill-brand-400 text-brand-400" />
        </div>
        </div>
      </div>

      {showSettings && <RemindersSettings onClose={() => setShowSettings(false)} />}
      {showReport && <ReportSheet onClose={() => setShowReport(false)} />}
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

/** Live medication status — its own 1s tick so the rest of the dashboard doesn't re-render each second. */
function MedStatusCard({ onManage }: { onManage: () => void }) {
  useStore();
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 1000); return () => clearInterval(id); }, []);

  const s = todayMedStatus(new Date());
  const date = todayISO();
  if (s.total === 0) {
    return (
      <button onClick={onManage} className="card w-full p-4 mt-3 flex items-center gap-3.5 text-left">
        <span className="grid place-items-center h-11 w-11 rounded-2xl bg-peach text-[#c8622f] shrink-0"><Pill className="h-[22px] w-[22px]" /></span>
        <div className="flex-1"><p className="font-bold text-ink text-[15px]">Médicaments</p><p className="text-[12.5px] text-ink-mute">Aucune prise prévue aujourd'hui · configurer</p></div>
        <ChevronRight className="h-5 w-5 text-ink-mute" />
      </button>
    );
  }

  return (
    <section className="card p-4 mt-3">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-[16px] font-semibold text-ink flex items-center gap-2"><Pill className="h-[18px] w-[18px] text-[#c8622f]" /> Médicaments du jour</h2>
        <span className="text-[12.5px] font-bold text-ink-mute tabular-nums">{s.takenCount}/{s.total}</span>
      </div>

      {/* status banner */}
      {s.allTaken ? (
        <div className="flex items-center gap-2.5 rounded-2xl bg-mint px-4 py-3 mb-3">
          <CheckCircle2 className="h-5 w-5 text-brand-600" />
          <p className="text-[14px] font-bold text-brand-700">Tout est pris pour aujourd'hui</p>
        </div>
      ) : s.overdue ? (
        <div className="flex items-center gap-2.5 rounded-2xl bg-[#fbe1da] px-4 py-3 mb-3">
          <AlertTriangle className="h-5 w-5 text-[#d0492c]" />
          <p className="text-[14px] font-bold text-[#c0402a]">
            {s.overdue.dose.name} en retard de <span className="tabular-nums">{fmtDuration(s.overdue.msLate)}</span>
          </p>
        </div>
      ) : s.next ? (
        <div className="flex items-center gap-2.5 rounded-2xl bg-brand-50 px-4 py-3 mb-3">
          <Clock className="h-5 w-5 text-brand-600" />
          <p className="text-[14px] font-bold text-brand-700">
            Prochaine prise ({s.next.dose.name}) dans <span className="tabular-nums">{fmtDuration(s.next.msUntil)}</span>
          </p>
        </div>
      ) : null}

      {/* dose list */}
      <div className="divide-y divide-black/5">
        {s.doses.map((d) => (
          <button key={d.medId + d.time} onClick={() => setMedTaken(date, d.medId, d.time, !d.taken)}
            className="w-full flex items-center gap-3 py-2.5 text-left">
            <span className="font-display font-semibold text-ink tabular-nums w-12">{d.time}</span>
            <span className="flex-1 min-w-0">
              <span className="font-bold text-ink text-[15px] block truncate">{d.name}</span>
              {d.dose && <span className="text-[12px] text-ink-mute">{d.dose}</span>}
            </span>
            <span className={`grid place-items-center h-7 w-7 rounded-lg border-2 transition ${d.taken ? "bg-brand-500 border-brand-500 text-white" : "border-black/15 text-transparent"}`}>
              <Check className="h-4 w-4" strokeWidth={3} />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
