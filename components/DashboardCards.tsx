"use client";

import { useState } from "react";
import {
  useStore, getWaterToday, addWater, resetWaterToday, WATER_GOAL_CL,
  getAddictions, addictionStat, logConsumption, undoLastConsumption,
  nextMilestone, encouragement,
} from "@/lib/storage";
import {
  GlassWater, Droplets, RotateCcw, Trophy, ShieldCheck, Undo2, Plus,
} from "lucide-react";

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
    <section className="card p-4 mt-3">
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
      <button onClick={onManage} className="card w-full p-4 mt-3 flex items-center gap-3.5 text-left">
        <span className="grid place-items-center h-11 w-11 rounded-2xl bg-lilac text-brand-700 shrink-0"><ShieldCheck className="h-[22px] w-[22px]" /></span>
        <div className="flex-1"><p className="font-bold text-ink text-[15px]">Contrôle des addictions</p><p className="text-[12.5px] text-ink-mute">Ajoute ce que tu veux arrêter · suivre tes streaks</p></div>
        <Plus className="h-5 w-5 text-ink-mute" />
      </button>
    );
  }
  return <div className="mt-3 space-y-3">{items.map((a) => <AddictionCard key={a.id} id={a.id} />)}</div>;
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
