"use client";

import { useEffect, useMemo, useState } from "react";
import {
  onChange, getMeds, saveEntry, moodLabel, LEVEL3, APPETITE3, Medication,
} from "@/lib/storage";
import { vibrate } from "@/lib/reminders";
import { RemindersSettings } from "@/components/RemindersSettings";
import { Portal } from "@/components/Portal";
import {
  Angry, Frown, Meh, Smile, Laugh, Zap, Utensils, Moon, Pill, Check, Plus, Save,
} from "lucide-react";

function faceFor(v: number | null) {
  if (v == null) return Meh;
  if (v <= 2) return Angry;
  if (v <= 4) return Frown;
  if (v <= 6) return Meh;
  if (v <= 8) return Smile;
  return Laugh;
}

export function MoodScreen({ active }: { active: boolean }) {
  const [tick, setTick] = useState(0);
  useEffect(() => onChange(() => setTick((t) => t + 1)), []);
  const meds = useMemo<Medication[]>(() => (typeof window !== "undefined" ? getMeds() : []), [tick]);

  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [appetite, setAppetite] = useState<number | null>(null);
  const [sleep, setSleep] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [taken, setTaken] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const Face = faceFor(mood);

  const reset = () => {
    setMood(null); setEnergy(null); setAppetite(null); setSleep(null); setNote(""); setTaken({});
  };

  const save = () => {
    if (mood == null) return;
    saveEntry({
      datetime: new Date().toISOString(),
      mood,
      energy: energy ?? undefined,
      appetite: appetite ?? undefined,
      sleep: sleep ?? undefined,
      note: note.trim() || undefined,
      medsTaken: Object.keys(taken).length ? taken : undefined,
    });
    vibrate(60);
    setSaved(true);
    reset();
    setTimeout(() => setSaved(false), 2200);
  };

  return (
    <div className="min-h-full px-5 pt-safe pb-6">
      <div className="max-w-md mx-auto stagger">
        <header className="pt-3 pb-1">
          <p className="text-[11px] font-bold tracking-widest uppercase text-brand-700/70">Nouvelle saisie</p>
          <h1 className="font-display text-[26px] font-semibold text-ink leading-tight">Ton humeur maintenant</h1>
        </header>

        {/* Selected preview */}
        <section className="rounded-4xl p-5 bg-lilac flex items-center gap-4 shadow-soft mt-3">
          <span className="grid place-items-center h-[72px] w-[72px] rounded-full bg-white text-brand-600 shrink-0">
            <Face className="h-9 w-9" strokeWidth={2} />
          </span>
          <div>
            <p className="text-[11px] font-bold tracking-widest uppercase text-ink-soft/70">Niveau</p>
            <p className="font-display text-2xl font-semibold text-ink">
              {mood != null ? `${mood}/10` : "—"}
            </p>
            <p className="text-[13px] text-ink-soft">{mood != null ? moodLabel(mood) : "Choisis de 1 à 10"}</p>
          </div>
        </section>

        {/* 1..10 scale */}
        <section className="card p-4 mt-3">
          <div className="grid grid-cols-5 gap-2.5">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
              const on = mood === n;
              return (
                <button
                  key={n}
                  onClick={() => { setMood(n); vibrate(15); }}
                  className={`aspect-square rounded-2xl grid place-items-center font-display font-semibold text-[17px] transition-all active:scale-90 ${
                    on ? "bg-brand-500 text-white shadow-glow scale-105" : "bg-brand-50 text-ink-soft"
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </section>

        {/* Energy + Appetite */}
        <section className="grid grid-cols-2 gap-3 mt-3">
          <Segmented icon={<Zap className="h-4 w-4" />} title="Énergie" options={LEVEL3 as unknown as string[]} value={energy} onChange={setEnergy} />
          <Segmented icon={<Utensils className="h-4 w-4" />} title="Appétit" options={APPETITE3 as unknown as string[]} value={appetite} onChange={setAppetite} />
        </section>

        {/* Sleep */}
        <section className="card p-4 mt-3">
          <div className="flex items-center gap-2 mb-3 text-brand-700">
            <Moon className="h-4 w-4" />
            <span className="text-[11px] font-bold tracking-widest uppercase text-ink-soft">Sommeil (h)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[4, 5, 6, 7, 8, 9, 10].map((h) => (
              <button
                key={h}
                onClick={() => setSleep(sleep === h ? null : h)}
                className={`h-10 w-10 rounded-xl font-display font-semibold text-[15px] transition active:scale-90 ${
                  sleep === h ? "bg-ink text-white" : "bg-brand-50 text-ink-soft"
                }`}
              >
                {h}
              </button>
            ))}
          </div>
        </section>

        {/* Medications */}
        <section className="card p-4 mt-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-brand-700">
              <Pill className="h-4 w-4" />
              <span className="text-[11px] font-bold tracking-widest uppercase text-ink-soft">Médicaments</span>
            </div>
            <button onClick={() => setShowSettings(true)} className="text-[13px] font-bold text-brand-700 inline-flex items-center gap-1">
              <Plus className="h-4 w-4" /> Gérer
            </button>
          </div>
          {meds.length === 0 ? (
            <p className="text-sm text-ink-mute">Aucun médicament. Ajoute-les dans « Gérer » pour les cocher ici.</p>
          ) : (
            <div className="divide-y divide-black/5">
              {meds.map((m) => {
                const on = !!taken[m.id];
                return (
                  <button
                    key={m.id}
                    onClick={() => setTaken((t) => ({ ...t, [m.id]: !on }))}
                    className="w-full flex items-center gap-3 py-3 text-left"
                  >
                    <span className="grid place-items-center h-9 w-9 rounded-xl bg-peach text-[#c8622f] shrink-0">
                      <Pill className="h-[18px] w-[18px]" />
                    </span>
                    <span className="flex-1 font-bold text-ink text-[15px]">{m.name}</span>
                    {m.dose && <span className="text-[12px] text-ink-mute mr-1">{m.dose}</span>}
                    <span className={`grid place-items-center h-7 w-7 rounded-lg border-2 transition ${on ? "bg-brand-500 border-brand-500 text-white" : "border-black/15 text-transparent"}`}>
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Note */}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Une note sur ta journée (optionnel)…"
          rows={3}
          className="w-full mt-3 p-4 rounded-3xl bg-white shadow-card text-[15px] text-ink placeholder:text-ink-mute resize-none outline-none focus:ring-2 focus:ring-brand-300"
        />

        {/* Save */}
        <button
          onClick={save}
          disabled={mood == null}
          className="w-full mt-4 rounded-3xl py-4 font-display text-[17px] font-semibold text-white flex items-center justify-center gap-2 transition active:scale-[.99] disabled:opacity-40 disabled:shadow-none bg-brand-500 shadow-glow"
        >
          <Save className="h-5 w-5" /> Enregistrer
        </button>
      </div>

      {/* Saved toast */}
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

function Segmented({ icon, title, options, value, onChange }: {
  icon: React.ReactNode; title: string; options: string[];
  value: number | null; onChange: (v: number | null) => void;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3 text-brand-700">
        {icon}
        <span className="text-[11px] font-bold tracking-widest uppercase text-ink-soft">{title}</span>
      </div>
      <div className="flex gap-1.5">
        {options.map((opt, i) => {
          const on = value === i + 1;
          return (
            <button
              key={opt}
              onClick={() => onChange(on ? null : i + 1)}
              className={`flex-1 rounded-xl py-2 text-[13px] font-bold transition active:scale-95 ${on ? "bg-ink text-white" : "bg-brand-50 text-ink-soft"}`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
