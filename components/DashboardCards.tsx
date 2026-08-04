"use client";

import { useState } from "react";
import {
  useStore, getWaterToday, addWater, resetWaterToday, WATER_GOAL_CL,
  getAddictions, addictionStat, logConsumption, undoLastConsumption,
  nextMilestone, encouragement, getDoctors, Appointment,
  getBrushToday, addBrush, resetBrushToday, brushStreak, BRUSH_GOAL,
  menstrualStatus, logPeriodStart, endCurrentPeriod, sexStats, addSexLog,
} from "@/lib/storage";
import { hTap } from "@/lib/haptics";
import {
  GlassWater, Droplets, RotateCcw, Trophy, ShieldCheck, Undo2, Plus, CalendarClock, MapPin,
  Sparkles, Droplet, Heart,
} from "lucide-react";

function relativeWhen(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms < 0) return "maintenant";
  const h = Math.floor(ms / 3600e3), d = Math.floor(h / 24);
  if (d >= 1) return `dans ${d} jour${d > 1 ? "s" : ""}`;
  if (h >= 1) return `dans ${h} h`;
  return `dans ${Math.max(1, Math.round(ms / 60000))} min`;
}

export function NextApptCard({ appt }: { appt: Appointment }) {
  useStore();
  const doc = appt.doctorId ? getDoctors().find((d) => d.id === appt.doctorId) : undefined;
  const dt = new Date(appt.datetime);
  const when = dt.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) + " · " + dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return (
    <section className="rounded-4xl p-5 bg-lilac shadow-soft">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-display text-[16px] font-semibold text-ink flex items-center gap-2"><CalendarClock className="h-[18px] w-[18px] text-brand-600" /> Prochain rendez-vous</h2>
        <span className="text-[12px] font-bold text-brand-700 bg-white/70 rounded-full px-2.5 py-1">{relativeWhen(appt.datetime)}</span>
      </div>
      <p className="font-display text-lg font-semibold text-ink">{appt.title}</p>
      {doc && <p className="text-[13.5px] text-ink-soft">{doc.name}{doc.specialty ? ` · ${doc.specialty}` : ""}</p>}
      <p className="text-[13px] text-ink-soft capitalize mt-1">{when}</p>
      {appt.address && (
        <a href={`https://maps.google.com/?q=${encodeURIComponent(appt.address)}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-700">
          <MapPin className="h-4 w-4" /> {appt.address}
        </a>
      )}
    </section>
  );
}

function litres(cl: number) { return (cl / 100).toFixed(2).replace(".", ",") + " L"; }

export function WaterCard() {
  useStore();
  const cl = getWaterToday();
  const pct = Math.min(100, Math.round((cl / WATER_GOAL_CL) * 100));
  const opts = [
    { cl: 25, label: "Petit verre", size: "h-5 w-5" },
    { cl: 50, label: "Grand verre", size: "h-6 w-6" },
    { cl: 75, label: "Bouteille", size: "h-7 w-7" },
  ];
  return (
    <section className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-[16px] font-semibold text-ink flex items-center gap-2"><Droplets className="h-[18px] w-[18px] text-sky-500" /> Hydratation</h2>
        <button onClick={resetWaterToday} className="grid place-items-center h-8 w-8 rounded-lg text-ink-mute active:scale-90" aria-label="Réinitialiser"><RotateCcw className="h-4 w-4" /></button>
      </div>

      <div className="flex items-end justify-between mb-1.5">
        <span className="font-display text-3xl font-semibold text-ink tabular-nums">{litres(cl)}</span>
        <span className="text-[13px] text-ink-mute mb-1">objectif {litres(WATER_GOAL_CL)}</span>
      </div>
      <div className="h-2.5 rounded-full bg-sky-100 overflow-hidden mb-4">
        <div className="h-full rounded-full bg-sky-400 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {opts.map((o) => (
          <button key={o.cl} onClick={() => addWater(o.cl)}
            className="flex flex-col items-center gap-1 rounded-2xl py-3 bg-sky-50 text-sky-700 active:scale-95 transition">
            <GlassWater className={o.size} strokeWidth={2} />
            <span className="font-display font-semibold text-[15px] leading-none">+{o.cl}cl</span>
            <span className="text-[10.5px] text-sky-600/80 font-semibold">{o.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function AddictionsSection({ onManage }: { onManage: () => void }) {
  useStore();
  const items = getAddictions();
  if (items.length === 0) {
    return (
      <button onClick={onManage} className="card w-full p-4 flex items-center gap-3.5 text-left">
        <span className="grid place-items-center h-11 w-11 rounded-2xl bg-lilac text-brand-700 shrink-0"><ShieldCheck className="h-[22px] w-[22px]" /></span>
        <div className="flex-1"><p className="font-bold text-ink text-[15px]">Contrôle des addictions</p><p className="text-[12.5px] text-ink-mute">Ajoute ce que tu veux arrêter · suivre tes streaks</p></div>
        <Plus className="h-5 w-5 text-ink-mute" />
      </button>
    );
  }
  return <div className="space-y-3">{items.map((a) => <AddictionCard key={a.id} id={a.id} />)}</div>;
}

function AddictionCard({ id }: { id: string }) {
  useStore();
  const [confirm, setConfirm] = useState(false);
  const a = getAddictions().find((x) => x.id === id);
  if (!a) return null;
  const st = addictionStat(a);
  const nm = nextMilestone(st.streakDays);
  const prevMile = [0, 1, 3, 7, 14, 30, 60, 90, 180, 365].filter((m) => m <= st.streakDays).pop() ?? 0;
  const pct = Math.min(100, Math.round(((st.streakDays - prevMile) / (nm - prevMile)) * 100));

  return (
    <section className="rounded-4xl p-5 bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-glow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-[18px] w-[18px] text-white/80" />
          <h3 className="font-display text-[16px] font-semibold">{a.name}</h3>
        </div>
        <span className="inline-flex items-center gap-1 text-[12px] font-bold bg-white/15 rounded-full px-2.5 py-1"><Trophy className="h-3.5 w-3.5" /> record {st.bestStreak}j</span>
      </div>

      <div className="flex items-end gap-2 mt-3">
        <span className="font-display text-5xl font-semibold leading-none tabular-nums">{st.streakDays}</span>
        <span className="font-display text-lg font-semibold mb-1">jour{st.streakDays > 1 ? "s" : ""}</span>
        <span className="text-white/70 text-sm mb-1.5">sans craquer</span>
      </div>

      <p className="text-[13.5px] text-white/90 mt-2 leading-snug">{encouragement(st.streakDays, a.name)}</p>

      {/* progress to next milestone */}
      <div className="mt-3">
        <div className="flex justify-between text-[11px] text-white/70 font-semibold mb-1"><span>Prochain palier</span><span>{nm} jours</span></div>
        <div className="h-2 rounded-full bg-white/20 overflow-hidden"><div className="h-full rounded-full bg-white transition-all" style={{ width: `${pct}%` }} /></div>
      </div>

      <div className="flex items-center gap-2 mt-4">
        {confirm ? (
          <>
            <button onClick={() => { logConsumption(a.id); setConfirm(false); }}
              className="flex-1 rounded-2xl py-3 bg-white text-brand-700 font-bold text-sm active:scale-[.98]">Oui, j'ai consommé</button>
            <button onClick={() => setConfirm(false)} className="rounded-2xl px-4 py-3 bg-white/15 text-white font-bold text-sm active:scale-[.98]">Non</button>
          </>
        ) : (
          <>
            <button onClick={() => setConfirm(true)}
              className="flex-1 rounded-2xl py-3 bg-white/15 text-white font-bold text-sm active:scale-[.98]">J'ai consommé</button>
            {st.todayCount > 0 && (
              <button onClick={() => undoLastConsumption(a.id)} className="grid place-items-center h-11 w-11 rounded-2xl bg-white/15 text-white active:scale-95" aria-label="Annuler"><Undo2 className="h-5 w-5" /></button>
            )}
          </>
        )}
      </div>
      {st.todayCount > 0 && <p className="text-[12px] text-white/70 mt-2">{st.todayCount} consommation{st.todayCount > 1 ? "s" : ""} aujourd'hui · total {st.totalCount}</p>}
    </section>
  );
}

function relativeAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  if (d <= 0) return "aujourd'hui";
  if (d === 1) return "hier";
  if (d < 30) return `il y a ${d} j`;
  const mo = Math.floor(d / 30);
  return `il y a ${mo} mois`;
}

// ── Brushing ─────────────────────────────────────────────────────────────────
export function BrushingCard() {
  useStore();
  const c = getBrushToday();
  const pct = Math.min(100, Math.round((c / BRUSH_GOAL) * 100));
  const strk = brushStreak();
  return (
    <section className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-[16px] font-semibold text-ink flex items-center gap-2"><Sparkles className="h-[18px] w-[18px] text-brand-600" /> Brossage des dents</h2>
        <button onClick={resetBrushToday} className="grid place-items-center h-8 w-8 rounded-lg text-ink-mute active:scale-90" aria-label="Réinitialiser"><RotateCcw className="h-4 w-4" /></button>
      </div>
      <div className="flex items-end justify-between mb-1.5">
        <span className="font-display text-3xl font-semibold text-ink tabular-nums">{c}/{BRUSH_GOAL}</span>
        <span className="text-[13px] text-ink-mute mb-1">{strk > 0 ? `série ${strk} j` : "objectif du jour"}</span>
      </div>
      <div className="h-2.5 rounded-full bg-brand-50 overflow-hidden mb-4">
        <div className="h-full rounded-full bg-brand-400 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <button onClick={() => { hTap(); addBrush(1); }} className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 bg-brand-500 text-white font-bold text-sm active:scale-[.98]"><Plus className="h-4 w-4" /> J'ai brossé mes dents</button>
    </section>
  );
}

// ── Menstrual cycle ──────────────────────────────────────────────────────────
export function MenstrualCard() {
  useStore();
  const s = menstrualStatus();
  const rose = "#e0588a";
  return (
    <section className="rounded-4xl p-5 shadow-soft" style={{ background: "#fbe3ec" }}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-display text-[16px] font-semibold text-ink flex items-center gap-2"><Droplet className="h-[18px] w-[18px]" style={{ color: rose }} /> Cycle menstruel</h2>
        {s.hasData && <span className="text-[12px] font-bold rounded-full px-2.5 py-1 bg-white/70" style={{ color: rose }}>~{s.avgCycle} j</span>}
      </div>
      {!s.hasData ? (
        <>
          <p className="text-[13.5px] text-ink-soft mb-3">Enregistre le 1ᵉʳ jour de tes règles pour suivre ton cycle et prédire les prochaines.</p>
          <button onClick={() => { hTap(); logPeriodStart(); }} className="w-full rounded-2xl py-3 text-white font-bold text-sm active:scale-[.98]" style={{ background: rose }}>J'ai mes règles aujourd'hui</button>
        </>
      ) : s.onPeriod ? (
        <>
          <div className="flex items-end gap-2">
            <span className="font-display text-4xl font-semibold text-ink tabular-nums">J{s.periodDay}</span>
            <span className="text-ink-soft mb-1.5">Règles en cours</span>
          </div>
          <button onClick={() => { hTap(); endCurrentPeriod(); }} className="mt-3 w-full rounded-2xl py-3 bg-white font-bold text-sm active:scale-[.98]" style={{ color: rose }}>Mes règles sont terminées</button>
        </>
      ) : (
        <>
          <div className="flex items-end gap-2">
            <span className="font-display text-4xl font-semibold text-ink tabular-nums">J{s.cycleDay}</span>
            <span className="text-ink-soft mb-1.5">du cycle</span>
          </div>
          <p className="text-[13.5px] mt-1 font-semibold" style={{ color: rose }}>
            {s.nextInDays != null && s.nextInDays > 0 ? `Prochaines règles dans ~${s.nextInDays} j`
              : s.nextInDays === 0 ? "Règles prévues aujourd'hui"
              : `Règles en retard de ${-(s.nextInDays ?? 0)} j`}
          </p>
          <button onClick={() => { hTap(); logPeriodStart(); }} className="mt-3 w-full rounded-2xl py-3 text-white font-bold text-sm active:scale-[.98]" style={{ background: rose }}>J'ai mes règles aujourd'hui</button>
        </>
      )}
    </section>
  );
}

// ── Sexual activity ──────────────────────────────────────────────────────────
export function SexualCard() {
  useStore();
  const [open, setOpen] = useState(false);
  const s = sexStats();
  const purple = "#9b6dd6";
  return (
    <section className="rounded-4xl p-5 shadow-soft bg-lilac">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-display text-[16px] font-semibold text-ink flex items-center gap-2"><Heart className="h-[18px] w-[18px]" style={{ color: purple }} /> Vie sexuelle</h2>
        <span className="text-[12px] font-bold text-brand-700 bg-white/70 rounded-full px-2.5 py-1">ce mois : {s.monthCount}</span>
      </div>
      <p className="text-[13.5px] text-ink-soft">Dernier : {s.last ? relativeAgo(s.last) : "aucun rapport"}{s.protectedRate != null ? ` · ${s.protectedRate}% protégés` : ""}</p>
      {open ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => { hTap(); addSexLog({ protected: true }); setOpen(false); }} className="rounded-2xl py-3 bg-white font-bold text-sm text-ink active:scale-[.98]">Protégé</button>
          <button onClick={() => { hTap(); addSexLog({ protected: false }); setOpen(false); }} className="rounded-2xl py-3 bg-white font-bold text-sm text-ink active:scale-[.98]">Non protégé</button>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="mt-3 w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-white font-bold text-sm active:scale-[.98]" style={{ background: purple }}><Plus className="h-4 w-4" /> Ajouter un rapport</button>
      )}
    </section>
  );
}
