"use client";

import { Home, SmilePlus, Plus, HeartPulse } from "lucide-react";

export function BottomNav({ tab, onTab, onHealth }: { tab: number; onTab: (i: number) => void; onHealth: () => void }) {
  return (
    <div className="pb-safe px-5 pt-1.5 shrink-0">
      <nav
        className="mx-auto w-fit flex items-center gap-1 rounded-full px-1.5 py-1.5 border border-white/60 shadow-[0_12px_34px_-10px_rgba(16,40,28,.35)]"
        style={{ background: "rgba(255,255,255,0.55)", backdropFilter: "blur(22px) saturate(180%)", WebkitBackdropFilter: "blur(22px) saturate(180%)" }}
      >
        <button onClick={() => onTab(0)} aria-label="Accueil"
          className={`grid place-items-center h-11 w-11 rounded-full transition-colors ${tab === 0 ? "bg-ink/[0.07] text-ink" : "text-ink/40"}`}>
          <Home className="h-[22px] w-[22px]" strokeWidth={2.3} />
        </button>

        <button onClick={() => onTab(1)} aria-label="Noter mon humeur"
          className="grid place-items-center h-12 w-12 rounded-full bg-brand-500 text-white shadow-glow active:scale-95 transition-transform mx-0.5">
          <Plus className="h-6 w-6" strokeWidth={2.6} />
        </button>

        <button onClick={() => onTab(1)} aria-label="Humeur"
          className={`grid place-items-center h-11 w-11 rounded-full transition-colors ${tab === 1 ? "bg-ink/[0.07] text-ink" : "text-ink/40"}`}>
          <SmilePlus className="h-[22px] w-[22px]" strokeWidth={2.3} />
        </button>

        <button onClick={onHealth} aria-label="Espace santé"
          className="grid place-items-center h-11 w-11 rounded-full text-ink/40 active:text-ink transition-colors">
          <HeartPulse className="h-[22px] w-[22px]" strokeWidth={2.3} />
        </button>
      </nav>
    </div>
  );
}
