"use client";

import { useState } from "react";
import {
  saveSettings, saveMed, saveDoctor, saveMedicalProfile, getSettings, ALL_DAYS, ModuleKey,
} from "@/lib/storage";
import {
  Smile, Pill, ShieldCheck, Droplets, Dumbbell, CalendarClock, Check, ChevronRight, Lock, Sparkles, Heart,
} from "lucide-react";

const GOALS: { key: string; label: string; icon: any; module?: ModuleKey }[] = [
  { key: "mood", label: "Suivre mon humeur", icon: Smile },
  { key: "meds", label: "Gérer mes traitements", icon: Pill },
  { key: "addiction", label: "Contrôler une addiction", icon: ShieldCheck, module: "addiction" },
  { key: "water", label: "M'hydrater", icon: Droplets, module: "water" },
  { key: "sport", label: "Bouger / sport", icon: Dumbbell, module: "sport" },
  { key: "rdv", label: "Suivre mes RDV médecin", icon: CalendarClock },
];

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [goals, setGoals] = useState<Set<string>>(new Set(["mood"]));
  const [morning, setMorning] = useState(true);
  const [evening, setEvening] = useState(true);
  const [mTime1, setMTime1] = useState("09:00");
  const [mTime2, setMTime2] = useState("20:00");
  const [medName, setMedName] = useState("");
  const [medTime, setMedTime] = useState("21:00");
  const [gp, setGp] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [birth, setBirth] = useState("");

  const steps = ["intro", "name", "goals", "times", "meds", "doctor", "body", "outro"];
  const total = steps.length;
  const next = () => setStep((s) => Math.min(total - 1, s + 1));
  const toggleGoal = (k: string) => setGoals((g) => { const n = new Set(g); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const finish = () => {
    const modules = GOALS.filter((g) => g.module && goals.has(g.key)).map((g) => g.module!) as ModuleKey[];
    const moodSlots = [
      ...(morning ? [{ time: mTime1, days: ALL_DAYS }] : []),
      ...(evening ? [{ time: mTime2, days: ALL_DAYS }] : []),
    ];
    saveSettings({ name: name.trim() || undefined, modules, moodSlots: moodSlots.length ? moodSlots : getSettings().moodSlots, onboarded: true });
    if (medName.trim()) saveMed({ name: medName.trim(), slots: [{ time: medTime, days: ALL_DAYS }] });
    if (gp.trim()) saveDoctor({ name: gp.trim(), specialty: "Médecine générale" });
    if (height || weight || birth) saveMedicalProfile({ height: height || undefined, weight: weight || undefined, birthDate: birth ? `${birth}-01-01` : undefined });
    onDone();
  };

  const s = steps[step];

  return (
    <div className="fixed inset-0 z-[95] bg-cream flex flex-col pt-safe pb-safe">
      {/* progress */}
      <div className="px-6 pt-4 flex gap-1.5">
        {steps.map((_, i) => <div key={i} className={`h-1.5 flex-1 rounded-full transition ${i <= step ? "bg-brand-500" : "bg-black/10"}`} />)}
      </div>

      <div className="flex-1 overflow-y-auto overscroll-none px-6 pt-6">
        {s === "intro" && (
          <div className="text-center pt-8 stagger">
            <img src="./brand/moody-icon.png" alt="" className="h-24 w-24 rounded-[28px] shadow-card mx-auto mb-6" />
            <h1 className="font-display text-3xl font-semibold text-ink">Bienvenue sur Moody</h1>
            <p className="text-ink-soft mt-3 leading-relaxed max-w-sm mx-auto">Ton compagnon doux pour suivre ton humeur, tes traitements et ton bien-être — au quotidien.</p>
            <div className="mt-6 inline-flex items-center gap-2 text-[13px] font-semibold text-brand-700 bg-cream rounded-full px-4 py-2"><Lock className="h-4 w-4" /> 100% privé, tout reste sur ton téléphone</div>
            <p className="text-[13px] text-ink-mute mt-6 max-w-sm mx-auto">Quelques questions rapides (toutes facultatives) pour personnaliser ton espace.</p>
          </div>
        )}

        {s === "name" && (
          <Step title="Comment tu t'appelles ?" sub="Pour un accueil qui te ressemble.">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ton prénom" className="w-full bg-white shadow-card rounded-2xl px-4 py-4 text-lg font-semibold text-ink outline-none focus:ring-2 focus:ring-brand-300" />
          </Step>
        )}

        {s === "goals" && (
          <Step title="Que veux-tu suivre ?" sub="Choisis ce qui t'est utile. Tu pourras changer plus tard.">
            <div className="grid grid-cols-2 gap-2.5">
              {GOALS.map((g) => {
                const on = goals.has(g.key); const Icon = g.icon;
                return (
                  <button key={g.key} onClick={() => toggleGoal(g.key)} className={`rounded-2xl p-4 text-left transition active:scale-[.98] ${on ? "bg-brand-500 text-white shadow-glow" : "bg-white shadow-card"}`}>
                    <Icon className={`h-6 w-6 mb-2 ${on ? "text-white" : "text-brand-600"}`} />
                    <p className="font-bold text-[14px] leading-tight">{g.label}</p>
                  </button>
                );
              })}
            </div>
          </Step>
        )}

        {s === "times" && (
          <Step title="Quand te rappeler ton humeur ?" sub="Aux moments qui te vont le mieux.">
            <div className="space-y-3">
              <TimeToggle on={morning} setOn={setMorning} label="Le matin" time={mTime1} setTime={setMTime1} />
              <TimeToggle on={evening} setOn={setEvening} label="Le soir" time={mTime2} setTime={setMTime2} />
            </div>
          </Step>
        )}

        {s === "meds" && (
          <Step title="Un traitement à suivre ?" sub="Ajoute-en un pour commencer (facultatif).">
            <input value={medName} onChange={(e) => setMedName(e.target.value)} placeholder="Nom du médicament" className="w-full bg-white shadow-card rounded-2xl px-4 py-3.5 font-semibold text-ink outline-none mb-3" />
            {medName.trim() && (
              <label className="flex items-center justify-between bg-white shadow-card rounded-2xl px-4 py-3.5">
                <span className="font-semibold text-ink">Heure de prise</span>
                <input type="time" value={medTime} onChange={(e) => setMedTime(e.target.value)} className="bg-cream rounded-xl px-3 py-2 font-display font-semibold text-ink outline-none" />
              </label>
            )}
          </Step>
        )}

        {s === "doctor" && (
          <Step title="Ton médecin généraliste ?" sub="On créera sa fiche automatiquement (facultatif).">
            <input value={gp} onChange={(e) => setGp(e.target.value)} placeholder="Dr …" className="w-full bg-white shadow-card rounded-2xl px-4 py-3.5 font-semibold text-ink outline-none" />
          </Step>
        )}

        {s === "body" && (
          <Step title="Quelques infos physiques ?" sub="Utile pour tes rapports — entièrement facultatif.">
            <div className="grid grid-cols-3 gap-2.5">
              <NumBox label="Taille (cm)" v={height} set={setHeight} />
              <NumBox label="Poids (kg)" v={weight} set={setWeight} />
              <NumBox label="Année naiss." v={birth} set={setBirth} />
            </div>
          </Step>
        )}

        {s === "outro" && (
          <div className="text-center pt-10 stagger">
            <div className="mx-auto grid place-items-center h-24 w-24 rounded-full bg-brand-500 text-white shadow-glow animate-pulseRing mb-6"><Sparkles className="h-11 w-11" /></div>
            <h1 className="font-display text-3xl font-semibold text-ink">Tout est prêt{name.trim() ? `, ${name.trim()}` : ""} !</h1>
            <div className="mt-6 space-y-3 text-left max-w-sm mx-auto">
              <Bullet icon={Smile} text="Note ton humeur en quelques secondes, chaque jour." />
              <Bullet icon={Pill} text="Reçois tes rappels de traitement et coche tes prises." />
              <Bullet icon={CalendarClock} text="Garde tes médecins, documents et RDV au même endroit." />
              <Bullet icon={Heart} text="On t'accompagne en douceur — sans jugement, à ton rythme." />
            </div>
          </div>
        )}
      </div>

      {/* footer */}
      <div className="px-6 pt-3 space-y-2">
        {s === "outro" ? (
          <button onClick={finish} className="w-full rounded-3xl py-4 bg-brand-500 text-white font-display text-[17px] font-semibold shadow-glow flex items-center justify-center gap-2 active:scale-[.99]"><Check className="h-5 w-5" strokeWidth={2.6} /> C'est parti</button>
        ) : (
          <>
            <button onClick={next} className="w-full rounded-3xl py-4 bg-brand-500 text-white font-display text-[17px] font-semibold shadow-glow flex items-center justify-center gap-2 active:scale-[.99]">
              {s === "intro" ? "Commencer" : "Continuer"} <ChevronRight className="h-5 w-5" />
            </button>
            {s !== "intro" && <button onClick={next} className="w-full py-2.5 text-sm font-semibold text-ink-mute">Passer</button>}
          </>
        )}
      </div>
    </div>
  );
}

function Step({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="pt-4 animate-rise">
      <h1 className="font-display text-2xl font-semibold text-ink leading-tight">{title}</h1>
      <p className="text-ink-soft mt-1.5 mb-6">{sub}</p>
      {children}
    </div>
  );
}
function TimeToggle({ on, setOn, label, time, setTime }: { on: boolean; setOn: (b: boolean) => void; label: string; time: string; setTime: (t: string) => void }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 transition ${on ? "bg-white shadow-card" : "bg-black/[0.03]"}`}>
      <button onClick={() => setOn(!on)} className={`grid place-items-center h-8 w-8 rounded-lg border-2 ${on ? "bg-brand-500 border-brand-500 text-white" : "border-black/15 text-transparent"}`}><Check className="h-4 w-4" strokeWidth={3} /></button>
      <span className="flex-1 font-semibold text-ink">{label}</span>
      <input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={!on} className="bg-cream rounded-xl px-3 py-2 font-display font-semibold text-ink outline-none disabled:opacity-40" />
    </div>
  );
}
function NumBox({ label, v, set }: { label: string; v: string; set: (s: string) => void }) {
  return (
    <label className="block"><span className="text-[11px] font-bold tracking-widest uppercase text-ink-mute">{label}</span>
      <input type="number" value={v} onChange={(e) => set(e.target.value)} className="mt-1 w-full bg-white shadow-card rounded-xl px-3 py-3 text-center font-display font-semibold text-ink outline-none" /></label>
  );
}
function Bullet({ icon: Icon, text }: { icon: any; text: string }) {
  return <div className="flex items-center gap-3"><span className="grid place-items-center h-9 w-9 rounded-xl bg-cream text-brand-600 shrink-0"><Icon className="h-5 w-5" /></span><p className="text-[14px] text-ink-soft">{text}</p></div>;
}
