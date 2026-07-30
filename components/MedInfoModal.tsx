"use client";

import { catalogInfo } from "@/lib/meds-catalog";
import { MedHighlights } from "@/lib/storage";
import { Portal } from "@/components/Portal";
import { X, Pill, AlertTriangle, Activity, Lightbulb, ExternalLink } from "lucide-react";

export function MedInfoModal({ name, highlights, onClose }: { name: string; highlights?: MedHighlights; onClose: () => void }) {
  const h = highlights ?? catalogInfo(name);
  const notice = `https://www.google.com/search?q=${encodeURIComponent(name + " notice base publique médicaments ANSM")}`;

  return (
    <Portal>
      <div className="fixed inset-0 z-[85] flex flex-col justify-end" role="dialog" aria-modal="true">
        <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-cream rounded-t-4xl max-h-[88vh] overflow-y-auto overscroll-none animate-sheetUp pb-safe">
          <div className="sticky top-0 bg-cream/95 backdrop-blur px-5 pt-3 pb-3 z-10">
            <div className="mx-auto h-1.5 w-10 rounded-full bg-black/10 mb-3" />
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold text-ink flex items-center gap-2"><Pill className="h-5 w-5 text-[#c8622f]" /> {name}</h2>
              <button onClick={onClose} className="grid place-items-center h-10 w-10 rounded-2xl bg-white shadow-card text-ink-soft active:scale-95"><X className="h-5 w-5" /></button>
            </div>
          </div>

          <div className="px-5 pb-8 space-y-4">
            {h?.molecule || h?.classe ? (
              <p className="text-[13.5px] text-ink-soft">{[h?.molecule, h?.classe].filter(Boolean).join(" · ")}</p>
            ) : null}

            {!h && <p className="text-sm text-ink-mute">Résumé non disponible pour ce médicament. Tu peux scanner sa notice (Espace santé → Documents → Scanner) pour en extraire les points clés, ou consulter la notice officielle ci-dessous.</p>}

            {h?.risques?.length ? (
              <InfoBlock icon={<AlertTriangle className="h-[18px] w-[18px]" />} title="Précautions / risques" tint="bg-[#fbe1da]" color="text-[#c0402a]" items={h.risques} />
            ) : null}
            {h?.effets?.length ? (
              <InfoBlock icon={<Activity className="h-[18px] w-[18px]" />} title="Effets indésirables fréquents" tint="bg-peach" color="text-[#c8622f]" items={h.effets} />
            ) : null}
            {h?.conseils?.length ? (
              <InfoBlock icon={<Lightbulb className="h-[18px] w-[18px]" />} title="À savoir" tint="bg-mint" color="text-brand-700" items={h.conseils} />
            ) : null}

            <a href={notice} target="_blank" rel="noreferrer" className="w-full rounded-2xl bg-white shadow-card px-4 py-3.5 flex items-center gap-2 font-bold text-brand-700 active:scale-[.99]">
              <ExternalLink className="h-5 w-5" /> Voir la notice officielle
            </a>
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
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-[13.5px] text-ink-soft">
            <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${tint}`} /> {it}
          </li>
        ))}
      </ul>
    </section>
  );
}
