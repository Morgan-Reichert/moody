"use client";

import { Home, SmilePlus, Plus } from "lucide-react";

export function BottomNav({ tab, onTab }: { tab: number; onTab: (i: number) => void }) {
  return (
    <div className="pb-safe px-5 pt-2 shrink-0">
      <nav className="mx-auto max-w-sm flex items-center justify-between gap-2 rounded-full bg-ink text-white/70 pl-3 pr-3 py-2 shadow-pill">
        <button
          onClick={() => onTab(0)}
          className={`flex items-center gap-2 rounded-full px-4 py-2.5 transition-colors ${tab === 0 ? "bg-white/12 text-white" : "text-white/60"}`}
          aria-label="Accueil"
        >
          <Home className="h-5 w-5" strokeWidth={2.3} />
          <span className={`text-sm font-semibold ${tab === 0 ? "block" : "hidden"}`}>Accueil</span>
        </button>

        <button
          onClick={() => onTab(1)}
          className="grid place-items-center h-12 w-12 rounded-full bg-brand-500 text-white shadow-glow active:scale-95 transition-transform"
          aria-label="Noter mon humeur"
        >
          <Plus className="h-6 w-6" strokeWidth={2.6} />
        </button>

        <button
          onClick={() => onTab(1)}
          className={`flex items-center gap-2 rounded-full px-4 py-2.5 transition-colors ${tab === 1 ? "bg-white/12 text-white" : "text-white/60"}`}
          aria-label="Humeur"
        >
          <SmilePlus className="h-5 w-5" strokeWidth={2.3} />
          <span className={`text-sm font-semibold ${tab === 1 ? "block" : "hidden"}`}>Humeur</span>
        </button>
      </nav>
    </div>
  );
}
