"use client";

import { useEffect, useState } from "react";
import {
  useStore, getTodayEntries, average, streak, moodLabel,
  getSettings, getMeds, todayISO, setMedTaken, upcomingAppointments,
} from "@/lib/storage";
import { todayMedStatus, fmtDuration } from "@/lib/reminders";
import { MoodChart } from "@/components/MoodChart";
import { RemindersSettings } from "@/components/RemindersSettings";
import { ReportSheet } from "@/components/ReportSheet";
import { MedInfoModal } from "@/components/MedInfoModal";
import { WaterCard, AddictionsSection, NextApptCard, BrushingCard, MenstrualCard, SexualCard, InsightsCard, GratitudeCard, AdherenceCard, TipsCard, HealthCard } from "@/components/DashboardCards";
import { WeatherWidget } from "@/components/WeatherWidget";
import { SortableList, SortItem } from "@/components/SortableList";
import { BreathingModal } from "@/components/BreathingModal";
import { HelpModal } from "@/components/HelpModal";
import {
  Flame, Sparkles, TrendingUp, Pill, Smile, ChevronRight, Settings2,
  Check, Clock, AlertTriangle, FileText, CheckCircle2, Info, Wind, HeartHandshake,
} from "lucide-react";
import { hTap } from "@/lib/haptics";

function Ring({ value }: { value: number | null }) {
  const pct = value != null ? Math.max(4, (value / 10) * 100) : 0;
  return (
    <div className="relative h-[86px] w-[86px] rounded-full grid place-items-center shrink-0"
      style={{ background: `conic-gradient(#55be3c ${pct}%, rgba(85,190,60,.16) 0)` }}>
      <div className="absolute inset-[7px] rounded-full bg-white grid place-items-center">
        <span className="font-display text-[26px] leading-none text-ink font-semibold">{value != null ? value.toFixed(1) : "—"}</span>
      </div>
    </div>
  );
}

export function Dashboard({ mounted, onLogMood, onOpenVault }: { mounted: boolean; onLogMood: () => void; onOpenVault?: () => void }) {
  useStore();
  const [showSettings, setShowSettings] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showBreathe, setShowBreathe] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const today = mounted ? getTodayEntries() : [];
  const avg7 = mounted ? average(7) : null;
  const strk = mounted ? streak() : 0;
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
        <section className="rounded-4xl p-4 bg-mint shadow-soft flex items-stretch gap-3">
          <div className="flex flex-col justify-between min-w-0 py-1.5 pl-1.5">
            <div>
              <p className="font-display text-[30px] font-semibold text-brand-800 leading-none capitalize">{now.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</p>
              <p className="text-[13px] font-bold text-brand-700/80 capitalize mt-1.5">{now.toLocaleDateString("fr-FR", { weekday: "long" })}</p>
            </div>
            <p className="text-[10.5px] font-bold tracking-widest uppercase text-brand-700/60">Humeur du jour</p>
          </div>
          <div className="ml-auto rounded-3xl bg-white p-3 flex items-center gap-3 shadow-card">
            <Ring value={todayAvg} />
            <div className="pr-1.5">
              {todayAvg != null ? (
                <>
                  <p className="font-display text-[15px] font-semibold text-ink leading-tight">{moodLabel(todayAvg)}</p>
                  <p className="text-[12px] text-ink-mute mt-0.5">{today.length} saisie{today.length > 1 ? "s" : ""}</p>
                </>
              ) : (
                <>
                  <p className="font-display text-[15px] font-semibold text-ink leading-tight">Pas noté</p>
                  <button onClick={onLogMood} className="mt-1.5 rounded-full bg-ink text-white text-[12px] font-bold px-3 py-1.5 active:scale-95">Noter</button>
                </>
              )}
            </div>
          </div>
        </section>
      ),
    },
    {
      key: "stats",
      node: (
        <section className="grid grid-cols-3 gap-3">
          <Stat tint={0} icon={<TrendingUp className="h-4 w-4" />} value={avg7 != null ? avg7.toFixed(1) : "—"} label="Moy. 7 j" />
          <Stat tint={1} icon={<Flame className="h-4 w-4" />} value={String(strk)} label={strk > 1 ? "jours de série" : "jour de série"} />
          <Stat tint={2} icon={<Sparkles className="h-4 w-4" />} value={String(today.length)} label="aujourd'hui" />
        </section>
      ),
    },
    {
      key: "quick",
      node: (
        <section className="rounded-4xl p-5 bg-peach/55 shadow-soft">
          <h2 className="font-display text-[16px] font-semibold text-ink mb-3">Raccourcis</h2>
          <div className="grid grid-cols-2 gap-2.5">
            <QuickTile icon={<PlusCircle className="h-6 w-6 text-brand-600" />} title="Noter humeur" sub="En 10 secondes" onClick={onLogMood} />
            <QuickTile icon={<HeartPulse className="h-6 w-6 text-brand-600" />} title="Espace santé" sub="Ton carnet" onClick={() => onOpenVault?.()} />
            <QuickTile icon={<FileText className="h-6 w-6 text-brand-600" />} title="Rapport" sub="PDF médecin" onClick={() => setShowReport(true)} />
            <QuickTile icon={<Wind className="h-6 w-6 text-brand-600" />} title="Respirer" sub="1 min de calme" onClick={() => setShowBreathe(true)} />
          </div>
        </section>
      ),
    },
  ];
  const nextAppt = mounted ? upcomingAppointments()[0] : undefined;
  if (nextAppt) cards.push({ key: "appt", node: <NextApptCard appt={nextAppt} /> });
  if (mounted && meds.length > 0) cards.push({ key: "meds", node: <MedStatusCard onManage={() => setShowSettings(true)} /> });
  if (mounted && meds.length > 0 && settings?.modules.includes("adherence")) cards.push({ key: "adherence", node: <AdherenceCard /> });
  if (mounted && settings?.modules.includes("water")) cards.push({ key: "water", node: <WaterCard /> });
  if (mounted && settings?.modules.includes("brushing")) cards.push({ key: "brushing", node: <BrushingCard /> });
  if (mounted && settings?.modules.includes("menstrual")) cards.push({ key: "menstrual", node: <MenstrualCard /> });
  if (mounted && settings?.modules.includes("sexual")) cards.push({ key: "sexual", node: <SexualCard /> });
  if (mounted && settings?.modules.includes("health")) cards.push({ key: "health", node: <HealthCard /> });
  if (mounted && settings?.modules.includes("tips")) cards.push({ key: "tips", node: <TipsCard /> });
  if (mounted && settings?.modules.includes("gratitude")) cards.push({ key: "gratitude", node: <GratitudeCard /> });
  if (mounted && settings?.modules.includes("insights")) cards.push({ key: "insights", node: <InsightsCard /> });
  if (mounted && settings?.modules.includes("addiction")) cards.push({ key: "addiction", node: <AddictionsSection onManage={() => setShowSettings(true)} /> });
  if (settings && settings.moodSlots.length > 0) cards.push({
    key: "reminder",
    node: (
      <button onClick={onLogMood} className="card w-full p-3.5 flex items-center gap-3.5 text-left">
        <span className="grid place-items-center h-11 w-11 rounded-full bg-mint text-brand-700 shrink-0"><Smile className="h-[22px] w-[22px]" /></span>
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
          <button onClick={() => setShowReport(true)} className="rounded-full bg-cream px-3 py-1.5 text-[12px] font-bold text-ink-soft active:scale-95">Rapport</button>
        </div>
        <MoodChart />
      </section>
    ),
  });
  cards.push({
    key: "wellbeing",
    node: (
      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-4xl p-4 bg-peach flex flex-col items-start gap-2 shadow-soft">
          <span className="grid place-items-center h-10 w-10 rounded-full bg-white text-[#d4487e]"><Wind className="h-5 w-5" /></span>
          <p className="font-display text-[15px] font-semibold text-ink leading-tight">On respire<br />un moment ?</p>
          <button onClick={() => setShowBreathe(true)} className="mt-auto rounded-full bg-ink text-white text-[12.5px] font-bold px-4 py-2 shadow-glow active:scale-95">Respirer</button>
        </div>
        <div className="rounded-4xl p-4 bg-lilac flex flex-col items-start gap-2 shadow-soft">
          <span className="grid place-items-center h-10 w-10 rounded-full bg-white text-accent-deep"><HeartHandshake className="h-5 w-5" /></span>
          <p className="font-display text-[15px] font-semibold text-ink leading-tight">Besoin<br />d'écoute ?</p>
          <button onClick={() => setShowHelp(true)} className="mt-auto rounded-full bg-white text-ink text-[12.5px] font-bold px-4 py-2 shadow-card active:scale-95">Voir les lignes</button>
        </div>
      </section>
    ),
  });

  return (
    <div className="min-h-full pb-[calc(104px_+_env(safe-area-inset-bottom))]">
      {/* Sticky top bar — opaque at the very top, fading translucent downward */}
      <header className="sticky top-0 z-30 pt-safe px-5 pb-4 bg-gradient-to-b from-cream via-cream/90 to-transparent backdrop-blur-[6px]">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <span className="grid place-items-center h-11 w-11 rounded-full bg-white shadow-card border border-black/[0.045] overflow-hidden">
            <img src="./brand/moody-icon.png" alt="Moody" className="h-8 w-8 object-contain" />
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowReport(true)} className="grid place-items-center h-11 w-11 rounded-full bg-white shadow-card border border-black/[0.045] text-ink active:scale-95 transition" aria-label="Rapport">
              <FileText className="h-[19px] w-[19px]" strokeWidth={2.1} />
            </button>
            <button onClick={() => setShowSettings(true)} className="grid place-items-center h-11 w-11 rounded-full bg-white shadow-card border border-black/[0.045] text-ink active:scale-95 transition" aria-label="Réglages">
              <Settings2 className="h-[19px] w-[19px]" strokeWidth={2.1} />
            </button>
          </div>
        </div>
      </header>

      <div className="px-5">
        <div className="max-w-md mx-auto stagger">
        <div className="mt-4 mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-[27px] font-semibold text-ink leading-tight">{hello}{settings?.name ? `, ${settings.name}` : ""}.</h1>
            {settings?.mantra && <p className="text-[13px] text-brand-700 font-semibold mt-1 leading-snug">{settings.mantra}</p>}
          </div>
          {mounted && settings?.weather && <WeatherWidget />}
        </div>

        {/* Reorderable cards — long-press to rearrange */}
        <SortableList items={cards} />
        </div>
      </div>

      {showSettings && <RemindersSettings onClose={() => setShowSettings(false)} />}
      {showReport && <ReportSheet onClose={() => setShowReport(false)} />}
      {showBreathe && <BreathingModal onClose={() => setShowBreathe(false)} />}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}

const STAT_TINTS = ["bg-lilac text-accent-deep", "bg-peach text-[#d4487e]", "bg-butter text-[#b07f14]"];
function Stat({ icon, value, label, tint = 0 }: { icon: React.ReactNode; value: string; label: string; tint?: number }) {
  const cls = STAT_TINTS[tint % STAT_TINTS.length];
  return (
    <div className="card p-3.5 flex flex-col gap-2">
      <span className={`grid place-items-center h-8 w-8 rounded-full ${cls}`}>{icon}</span>
      <span className="font-display text-[22px] font-semibold text-ink leading-none">{value}</span>
      <span className="text-[11px] text-ink-mute font-semibold leading-tight">{label}</span>
    </div>
  );
}

function QuickTile({ icon, title, sub, onClick }: { icon: React.ReactNode; title: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={() => { hTap(); onClick(); }} className="rounded-2xl bg-white shadow-card p-4 flex flex-col items-start gap-1.5 active:scale-[.98] transition-transform text-left">
      {icon}
      <span className="font-bold text-ink text-[14px]">{title}</span>
      <span className="text-[11.5px] text-ink-mute">{sub}</span>
    </button>
  );
}

/** Live medication status — its own 1s tick so the rest of the dashboard doesn't re-render each second. */
function MedStatusCard({ onManage }: { onManage: () => void }) {
  useStore();
  const [, setTick] = useState(0);
  const [info, setInfo] = useState<{ name: string; h?: any; medId?: string } | null>(null);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 1000); return () => clearInterval(id); }, []);

  const s = todayMedStatus(new Date());
  const date = todayISO();
  const meds = getMeds();
  if (s.total === 0) {
    return (
      <button onClick={onManage} className="card w-full p-4 mt-3 flex items-center gap-3.5 text-left">
        <span className="grid place-items-center h-11 w-11 rounded-full bg-peach text-[#d4487e] shrink-0"><Pill className="h-[22px] w-[22px]" /></span>
        <div className="flex-1"><p className="font-bold text-ink text-[15px]">Médicaments</p><p className="text-[12.5px] text-ink-mute">Aucune prise prévue aujourd'hui · configurer</p></div>
        <ChevronRight className="h-5 w-5 text-ink-mute" />
      </button>
    );
  }

  return (
    <section className="card p-4 mt-3">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="font-display text-[16px] font-semibold text-ink flex items-center gap-2">
          <span className="grid place-items-center h-8 w-8 rounded-full bg-peach text-[#d4487e]"><Pill className="h-4 w-4" /></span>
          Médicaments du jour
        </h2>
        <span className="rounded-full bg-cream px-2.5 py-1 text-[12px] font-bold text-ink-soft tabular-nums">{s.takenCount}/{s.total}</span>
      </div>

      {/* jauge segmentée façon "lessons left" */}
      <div className="flex items-center gap-1.5 mb-3">
        {s.doses.map((d, i) => <span key={i} className={`seg ${d.taken ? "seg-on" : ""}`} />)}
        <span className="ml-1.5 text-[11.5px] font-bold text-ink-mute whitespace-nowrap">{s.total - s.takenCount > 0 ? `${s.total - s.takenCount} restante${s.total - s.takenCount > 1 ? "s" : ""}` : "terminé"}</span>
      </div>

      {/* status banner */}
      {s.allTaken ? (
        <div className="flex items-center gap-2.5 rounded-2xl bg-mint px-4 py-3 mb-3">
          <CheckCircle2 className="h-5 w-5 text-brand-600" />
          <p className="text-[14px] font-bold text-brand-700">Tout est pris pour aujourd'hui</p>
        </div>
      ) : s.overdue ? (
        <div className="flex items-center gap-2.5 rounded-2xl bg-[#ffe3e3] px-4 py-3 mb-3">
          <AlertTriangle className="h-5 w-5 text-[#e04444]" />
          <p className="text-[14px] font-bold text-[#d43c3c]">
            {s.overdue.dose.name} en retard de <span className="tabular-nums">{fmtDuration(s.overdue.msLate)}</span>
          </p>
        </div>
      ) : s.next ? (
        <div className="flex items-center gap-2.5 rounded-2xl bg-accent-soft px-4 py-3 mb-3">
          <Clock className="h-5 w-5 text-accent-deep" />
          <p className="text-[14px] font-bold text-accent-deep">
            Prochaine prise ({s.next.dose.name}) dans <span className="tabular-nums">{fmtDuration(s.next.msUntil)}</span>
          </p>
        </div>
      ) : null}

      {/* dose list */}
      <div className="divide-y divide-black/5">
        {s.doses.map((d) => (
          <div key={d.medId + d.time} className="flex items-center gap-2 py-2.5">
            <button onClick={() => setMedTaken(date, d.medId, d.time, !d.taken)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
              <span className="rounded-full bg-cream px-2.5 py-1.5 text-[12.5px] font-display font-semibold text-ink tabular-nums">{d.time}</span>
              <span className="flex-1 min-w-0">
                <span className="font-bold text-ink text-[15px] block truncate">{d.name}</span>
                {d.dose && <span className="text-[12px] text-ink-mute">{d.dose}</span>}
              </span>
            </button>
            <button onClick={() => setInfo({ name: d.name, h: meds.find((m) => m.id === d.medId)?.highlights, medId: d.medId })} className="grid place-items-center h-8 w-8 rounded-full text-accent active:scale-90" aria-label="Infos médicament"><Info className="h-[18px] w-[18px]" /></button>
            <button onClick={() => setMedTaken(date, d.medId, d.time, !d.taken)} className={`grid place-items-center h-7 w-7 rounded-full border-2 transition shrink-0 ${d.taken ? "bg-ink border-ink text-white" : "border-black/15 text-transparent"}`}>
              <Check className="h-4 w-4" strokeWidth={3} />
            </button>
          </div>
        ))}
      </div>
      {info && <MedInfoModal name={info.name} highlights={info.h} medId={info.medId} onClose={() => setInfo(null)} />}
    </section>
  );
}
