"use client";

import { useState } from "react";
import { catalogInfo } from "@/lib/meds-catalog";
import { MedHighlights, getMeds, saveMed, todayISO, useStore } from "@/lib/storage";
import { Portal } from "@/components/Portal";
import { X, Pill, AlertTriangle, Activity, Lightbulb, ExternalLink, Plus, Trash2, ShieldAlert } from "lucide-react";

export function MedInfoModal({ name, highlights, medId, onClose }: { name: string; highlights?: MedHighlights; medId?: string; onClose: () => void }) {
  useStore();
  const [txt, setTxt] = useState("");
  const h = highlights ?? catalogInfo(name);
  const notice = `https://www.google.com/search?q=${encodeURIComponent(name + " notice base publique médicaments ANSM")}`;
  const med = medId ? getMeds().find((m) => m.id === medId) : undefined;
  const effects = med?.sideEffects ?? [];

  const addEffect = () => {
    if (!med || !txt.trim()) return;
    saveMed({ ...med, sideEffects: [...effects, { date: todayISO(), text: txt.trim() }] });
    setTxt("");
  };
  const removeEffect = (i: number) => { if (!med) return; saveMed({ ...med, sideEffects: effects.filter((_, j) => j !== i) }); };

  return (
    <Portal>
      <div className="fixed inset-0 z-[85] flex flex-col justify-end" role="dialog" aria-modal="true">
        <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-cream rounded-t-4xl max-h-[88vh] overflow-y-auto overscroll-none animate-sheetUp pb-safe">
          <div className="sticky top-0 bg-cream/95 backdrop-blur px-5 pt-3 pb-3 z-10">
            <div className="mx-auto h-1.5 w-10 rounded-full bg-black/10 mb-3" />
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold text-ink flex items-center gap-2"><Pill className="h-5 w-5 text-[#d4487e]" /> {name}</h2>
              <button onClick={onClose} className="grid place-items-center h-10 w-10 rounded-2xl bg-white shadow-card text-ink-soft active:scale-95"><X className="h-5 w-5" /></button>
            </div>
          </div>

          <div className="px-5 pb-8 space-y-4">
            {h?.molecule || h?.classe ? <p className="text-[13.5px] text-ink-soft">{[h?.molecule, h?.classe].filter(Boolean).join(" · ")}</p> : null}
            {!h && <p className="text-sm text-ink-mute">Résumé non disponible. Scanne la notice (Réglages → médicament → Scanner la notice) ou consulte la notice officielle ci-dessous.</p>}

            {h?.risques?.length ? <InfoBlock icon={<AlertTriangle className="h-[18px] w-[18px]" />} title="Précautions / risques" tint="bg-[#fbe1da]" color="text-[#c0402a]" items={h.risques} /> : null}
            {h?.effets?.length ? <InfoBlock icon={<Activity className="h-[18px] w-[18px]" />} title="Effets indésirables fréquents" tint="bg-peach" color="text-[#d4487e]" items={h.effets} /> : null}
            {h?.conseils?.length ? <InfoBlock icon={<Lightbulb className="h-[18px] w-[18px]" />} title="À savoir" tint="bg-mint" color="text-brand-700" items={h.conseils} /> : null}

            {/* Adverse effects the patient experienced (go into the report) */}
            {med && (
              <section className="card p-4">
                <div className="flex items-center gap-2 text-[#c0402a] mb-2"><ShieldAlert className="h-[18px] w-[18px]" /><h3 className="font-display text-[15px] font-semibold text-ink">Effets indésirables ressentis</h3></div>
                <p className="text-[12px] text-ink-mute mb-2.5">Note ce que tu ressens — ce sera repris dans tes rapports médicaux (avec la date).</p>
                {effects.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {effects.map((e, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-xl bg-cream/80 px-3 py-2">
                        <span className="flex-1 text-[13.5px] text-ink"><b className="text-ink-mute font-semibold">{e.date}</b> — {e.text}</span>
                        <button onClick={() => removeEffect(i)} className="grid place-items-center h-7 w-7 rounded-lg text-red-400"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addEffect()} placeholder="Ex : nausées le matin…" className="flex-1 bg-cream rounded-xl px-3.5 py-2.5 text-ink outline-none" />
                  <button onClick={addEffect} className="grid place-items-center h-11 w-11 rounded-xl bg-brand-500 text-white active:scale-95"><Plus className="h-5 w-5" /></button>
                </div>
              </section>
            )}

            <a href={notice} target="_blank" rel="noreferrer" className="w-full rounded-2xl bg-white shadow-card px-4 py-3.5 flex items-center gap-2 font-bold text-brand-700 active:scale-[.99]"><ExternalLink className="h-5 w-5" /> Voir la notice officielle</a>
            <p className="text-[11px] text-ink-mute text-center">Résumé indicatif — la notice officielle fait foi. En cas de doute, demande à ton médecin ou pharmacien.</p>
          </div>
        </div>
      </div>
    </Portal>
  );
}

function InfoBlock({ icon, title, items, tint, color }: { icon: React.ReactNode; title: string; items: string[]; tint: string; color: string }) {
  return (
    <section className="card p-4">
      <div className={`flex items-center gap-2 mb-2 ${color}`}>{icon}<h3 className="font-display text-[15px] font-semibold text-ink">{title}</h3></div>
      <ul className="space-y-1.5">
        {items.map((it, i) => <li key={i} className="flex items-start gap-2 text-[13.5px] text-ink-soft"><span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${tint}`} /> {it}</li>)}
      </ul>
    </section>
  );
}
