"use client";

import { useState } from "react";
import {
  useStore, saveEntry, moodLabel, getSettings,
  ENERGY_LABELS, APPETITE_LABELS,
} from "@/lib/storage";
import { vibrate } from "@/lib/reminders";
import { DragSlider } from "@/components/DragSlider";
import { RemindersSettings } from "@/components/RemindersSettings";
import { Portal } from "@/components/Portal";
import {
  Angry, Frown, Meh, Smile, Laugh, Zap, Apple, Ban, Moon, Save, Check,
  Dumbbell, Droplets, Plus, Minus,
} from "lucide-react";

function faceFor(v: number | null) {
  if (v == null) return Meh;
  if (v <= 2) return Angry;
  if (v <= 4) return Frown;
  if (v <= 6) return Meh;
  if (v <= 8) return Smile;
  return Laugh;
}
function sleepLabel(v: number) { const h = Math.floor(v); const m = v % 1 ? "30" : "00"; return `${h}h${m}`; }

export function MoodScreen() {
  useStore();
  const settings = typeof window !== "undefined" ? getSettings() : null;
  const modules = settings?.modules ?? [];

  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [appetite, setAppetite] = useState<number | null>(null);
  const [sleep, setSleep] = useState<number | null>(null);
  const [sport, setSport] = useState<number | null>(null);
  const [water, setWater] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const Face = faceFor(mood);

  const reset = () => { setMood(null); setEnergy(null); setAppetite(null); setSleep(null); setSport(null); setWater(null); setNote(""); };

  const save = () => {
    if (mood == null) return;
    saveEntry({
      datetime: new Date().toISOString(),
      mood,
      energy: energy ?? undefined,
      appetite: appetite ?? undefined,
      sleep: sleep ?? undefined,
      sport: sport ?? undefined,
      water: water ?? undefined,
      note: note.trim() || undefined,
    });
    vibrate(60); setSaved(true); reset();
    setTimeout(() => setSaved(false), 2200);
  };

  return (
    <div className="min-h-full px-5 pt-safe pb-6">
      <div className="max-w-md mx-auto stagger">
        <header className="pt-3 pb-1">
          <p className="text-[11px] font-bold tracking-widest uppercase text-brand-700/70">Nouvelle saisie</p>
          <h1 className="font-display text-[26px] font-semibold text-ink leading-tight">Ton humeur, maintenant</h1>
        </header>

        {/* Preview */}
        <section className="rounded-4xl p-5 bg-lilac flex items-center gap-4 shadow-soft mt-3">
          <span className="grid place-items-center h-[72px] w-[72px] rounded-full bg-white text-brand-600 shrink-0">
            <Face className="h-9 w-9" strokeWidth={2} />
          </span>
          <div>
            <p className="text-[11px] font-bold tracking-widest uppercase text-ink-soft/70">Niveau</p>
            <p className="font-display text-2xl font-semibold text-ink">{mood != null ? `${mood}/10` : "—"}</p>
            <p className="text-[13px] text-ink-soft">{mood != null ? moodLabel(mood) : "Choisis de 1 à 10"}</p>
          </div>
        </section>

        {/* 1..10 */}
        <section className="card p-4 mt-3">
          <div className="grid grid-cols-5 gap-2.5">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
              const on = mood === n;
              return (
                <button key={n} onClick={() => { setMood(n); vibrate(15); }}
                  className={`aspect-square rounded-2xl grid place-items-center font-display font-semibold text-[17px] transition-all active:scale-90 ${on ? "bg-brand-500 text-white shadow-glow scale-105" : "bg-brand-50 text-ink-soft"}`}>
                  {n}
                </button>
              );
            })}
          </div>
        </section>

        {/* Énergie — drag slider */}
        <section className="card p-4 pb-3 mt-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-brand-700"><Zap className="h-4 w-4" />
              <span className="text-[11px] font-bold tracking-widest uppercase text-ink-soft">Énergie</span>
            </div>
            <span className="text-[13px] font-bold text-ink">{energy != null ? ENERGY_LABELS[energy - 1] : "—"}</span>
          </div>
          <DragSlider value={energy} min={1} max={5} step={1} onChange={setEnergy} showDots />
        </section>

        {/* Appétit — food size icons */}
        <section className="card p-4 mt-3">
          <div className="flex items-center gap-2 mb-3 text-brand-700"><Apple className="h-4 w-4" />
            <span className="text-[11px] font-bold tracking-widest uppercase text-ink-soft">Appétit</span>
          </div>
          <div className="grid grid-cols-4 gap-2.5">
            {[
              { v: 1, icon: <Ban className="h-6 w-6" />, label: "Rien" },
              { v: 2, icon: <Apple className="h-4 w-4" />, label: "Peu" },
              { v: 3, icon: <Apple className="h-6 w-6" />, label: "Moyen" },
              { v: 4, icon: <Apple className="h-8 w-8" />, label: "Fort" },
            ].map((o) => {
              const on = appetite === o.v;
              return (
                <button key={o.v} onClick={() => { setAppetite(o.v); vibrate(15); }}
                  className={`rounded-2xl py-3 flex flex-col items-center justify-center gap-1.5 h-[76px] transition-all active:scale-95 ${on ? "bg-brand-500 text-white shadow-glow" : "bg-brand-50 text-ink-soft"}`}>
                  {o.icon}
                  <span className="text-[11px] font-bold">{o.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Sommeil — drag slider, 30-min steps, growing Zzz */}
        <section className="card p-4 pb-3 mt-3">
          <div className="flex items-center gap-2 mb-1 text-brand-700"><Moon className="h-4 w-4" />
            <span className="text-[11px] font-bold tracking-widest uppercase text-ink-soft">Sommeil</span>
          </div>
          <DragSlider
            value={sleep} min={0} max={12} step={0.5} onChange={setSleep}
            thumbAbove={(v) => (
              <span className="font-display font-bold text-brand-600 leading-none" style={{ fontSize: `${14 + v * 2}px` }}>
                Z<span style={{ fontSize: "0.8em" }}>z</span><span style={{ fontSize: "0.6em" }}>z</span>
              </span>
            )}
            thumbBelow={(v) => (
              <span className="font-display font-semibold text-ink text-sm tabular-nums">{sleepLabel(v)}</span>
            )}
          />
        </section>

        {/* Optional modules */}
        {modules.includes("sport") && (
          <section className="card p-4 mt-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-brand-700"><Dumbbell className="h-4 w-4" />
                <span className="text-[11px] font-bold tracking-widest uppercase text-ink-soft">Sport</span>
              </div>
              <span className="text-[13px] font-bold text-ink">{sport ?? 0} min</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[0, 15, 30, 45, 60, 90].map((m) => (
                <button key={m} onClick={() => setSport(m)}
                  className={`px-3.5 h-10 rounded-xl font-display font-semibold text-sm transition active:scale-95 ${sport === m ? "bg-ink text-white" : "bg-brand-50 text-ink-soft"}`}>
                  {m === 0 ? "Aucun" : `${m}m`}
                </button>
              ))}
            </div>
          </section>
        )}

        {modules.includes("water") && (
          <section className="card p-4 mt-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-brand-700"><Droplets className="h-4 w-4" />
                <span className="text-[11px] font-bold tracking-widest uppercase text-ink-soft">Hydratation</span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setWater(Math.max(0, (water ?? 0) - 1))} className="grid place-items-center h-9 w-9 rounded-xl bg-brand-50 text-ink-soft active:scale-90"><Minus className="h-4 w-4" /></button>
                <span className="font-display text-lg font-semibold text-ink w-16 text-center tabular-nums">{water ?? 0} <span className="text-xs text-ink-mute">verres</span></span>
                <button onClick={() => setWater((water ?? 0) + 1)} className="grid place-items-center h-9 w-9 rounded-xl bg-brand-500 text-white active:scale-90"><Plus className="h-4 w-4" /></button>
              </div>
            </div>
          </section>
        )}

        {/* Note */}
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Une note sur ta journée (optionnel)…" rows={3}
          className="w-full mt-3 p-4 rounded-3xl bg-white shadow-card text-[15px] text-ink placeholder:text-ink-mute resize-none outline-none focus:ring-2 focus:ring-brand-300" />

        <button onClick={save} disabled={mood == null}
          className="w-full mt-4 rounded-3xl py-4 font-display text-[17px] font-semibold text-white flex items-center justify-center gap-2 transition active:scale-[.99] disabled:opacity-40 disabled:shadow-none bg-brand-500 shadow-glow">
          <Save className="h-5 w-5" /> Enregistrer
        </button>

        <button onClick={() => setShowSettings(true)} className="w-full mt-2 py-3 text-sm font-semibold text-ink-mute">
          Personnaliser mes suivis & rappels
        </button>
      </div>

      {saved && (
        <Portal>
          <div className="fixed left-1/2 -translate-x-1/2 bottom-28 z-50 animate-pop rounded-full bg-ink text-white text-sm font-semibold px-5 py-3 shadow-pill flex items-center gap-2">
            <Check className="h-4 w-4 text-brand-300" strokeWidth={3} /> Humeur enregistrée
          </div>
        </Portal>
      )}
      {showSettings && <RemindersSettings onClose={() => setShowSettings(false)} />}
    </div>
  );
}
