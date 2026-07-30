"use client";

import { Portal } from "@/components/Portal";
import { X, Phone, MessageCircle, HeartHandshake, Ambulance } from "lucide-react";

const RESOURCES = [
  { name: "3114 — Prévention du suicide", desc: "Écoute 24h/24, 7j/7, gratuit et confidentiel", tel: "3114", icon: HeartHandshake },
  { name: "SOS Amitié", desc: "Écoute anonyme, tous les jours", tel: "0972394050", icon: Phone },
  { name: "Fil Santé Jeunes", desc: "Pour les jeunes, 9h-23h (anonyme, gratuit)", tel: "0800235236", icon: MessageCircle },
  { name: "SAMU — 15", desc: "Urgence médicale vitale", tel: "15", icon: Ambulance },
  { name: "Urgences — 112", desc: "Numéro d'urgence européen", tel: "112", icon: Ambulance },
];

export function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Portal>
      <div className="fixed inset-0 z-[85] flex flex-col justify-end" role="dialog" aria-modal="true">
        <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-cream rounded-t-4xl max-h-[90vh] overflow-y-auto overscroll-none animate-sheetUp pb-safe">
          <div className="sticky top-0 bg-cream/95 backdrop-blur px-5 pt-3 pb-3 z-10">
            <div className="mx-auto h-1.5 w-10 rounded-full bg-black/10 mb-3" />
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold text-ink flex items-center gap-2"><HeartHandshake className="h-5 w-5 text-brand-600" /> Besoin d'aide ?</h2>
              <button onClick={onClose} className="grid place-items-center h-10 w-10 rounded-2xl bg-white shadow-card text-ink-soft active:scale-95"><X className="h-5 w-5" /></button>
            </div>
          </div>
          <div className="px-5 pb-8 space-y-3">
            <p className="text-[14px] text-ink-soft">Tu n'es pas seul·e. Si ça ne va pas, parler à quelqu'un peut vraiment aider. Ces lignes sont là pour toi, gratuitement.</p>
            {RESOURCES.map((r) => {
              const Icon = r.icon;
              return (
                <a key={r.name} href={`tel:${r.tel}`} className="card p-4 flex items-center gap-3.5 active:scale-[.99]">
                  <span className="grid place-items-center h-12 w-12 rounded-2xl bg-brand-500 text-white shrink-0"><Icon className="h-6 w-6" /></span>
                  <div className="flex-1 min-w-0"><p className="font-bold text-ink text-[15px]">{r.name}</p><p className="text-[12.5px] text-ink-mute">{r.desc}</p></div>
                  <Phone className="h-5 w-5 text-brand-600" />
                </a>
              );
            })}
            <p className="text-[11.5px] text-ink-mute text-center pt-1">Numéros en France. En cas de danger immédiat, appelle le 15 ou le 112.</p>
          </div>
        </div>
      </div>
    </Portal>
  );
}
