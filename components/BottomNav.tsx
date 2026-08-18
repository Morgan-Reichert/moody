"use client";

import { Home, SmilePlus, Plus, HeartPulse } from "lucide-react";

export function BottomNav({ tab, onTab, onHealth }: { tab: number; onTab: (i: number) => void; onHealth: () => void }) {
  return (
    <div className="pb-safe px-5 pt-1.5 shrink-0">
      <nav className="mx-auto w-fit flex items-center gap-1 rounded-full bg-white/80 backdrop-blur-xl border border-white/70 px-1.5 py-1.5 shadow-pill">
        <button onClick={() => onTab(0)} aria-label="Accueil"
          className={`grid place-items-center h-11 w-11 rounded-full transition-all ${tab === 0 ? "bg-ink text-white shadow-glow" : "text-ink-mute"}`}>
          <Home className="h-[21px] w-[21px]" strokeWidth={2.3} />
        </button>

        <button onClick={() => onTab(1)} aria-label="Noter mon humeur"
          className="grid place-items-center h-12 w-12 rounded-full bg-brand-500 text-white shadow-glow active:scale-95 transition-transform">
          <Plus className="h-6 w-6" strokeWidth={2.6} />
        </button>

        <button onClick={() => onTab(1)} aria-label="Humeur"
          className={`grid place-items-center h-11 w-11 rounded-full transition-all ${tab === 1 ? "bg-ink text-white shadow-glow" : "text-ink-mute"}`}>
          <SmilePlus className="h-[21px] w-[21px]" strokeWidth={2.3} />
        </button>

        <button onClick={onHealth} aria-label="Espace santé"
          className="grid place-items-center h-11 w-11 rounded-full text-ink-mute transition-colors">
          <HeartPulse className="h-[21px] w-[21px]" strokeWidth={2.3} />
        </button>
      </nav>
    </div>
  );
}
