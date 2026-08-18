"use client";

import { useMemo, useState } from "react";
import { searchSpecialties } from "@/lib/specialties";
import { Portal } from "@/components/Portal";
import { Search, ChevronDown, X, Check, Stethoscope } from "lucide-react";

export function SpecialtyPicker({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const groups = useMemo(() => {
    const res = searchSpecialties(q);
    const map = new Map<string, string[]>();
    for (const s of res) { if (!map.has(s.group)) map.set(s.group, []); map.get(s.group)!.push(s.name); }
    return Array.from(map.entries());
  }, [q]);

  return (
    <>
      <button onClick={() => { setOpen(true); setQ(""); }} className="w-full flex items-center gap-2 bg-cream rounded-xl px-3.5 py-3 text-left active:scale-[.99]">
        <Stethoscope className="h-4 w-4 text-brand-600 shrink-0" />
        <span className={`flex-1 font-semibold truncate ${value ? "text-ink" : "text-ink-mute"}`}>{value || "Choisir une spécialité"}</span>
        <ChevronDown className="h-4 w-4 text-ink-mute" />
      </button>

      {open && (
        <Portal>
          <div className="fixed inset-0 z-[90] flex flex-col justify-end" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <div className="relative bg-cream rounded-t-4xl max-h-[85vh] flex flex-col animate-sheetUp pb-safe">
              <div className="px-5 pt-3 pb-2">
                <div className="mx-auto h-1.5 w-10 rounded-full bg-black/10 mb-3" />
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display text-lg font-semibold text-ink">Spécialité</h2>
                  <button onClick={() => setOpen(false)} className="grid place-items-center h-9 w-9 rounded-xl bg-white shadow-card text-ink-soft active:scale-95"><X className="h-5 w-5" /></button>
                </div>
                <div className="flex items-center gap-2 bg-white rounded-2xl px-3.5 py-3 shadow-card">
                  <Search className="h-4 w-4 text-ink-mute" />
                  <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (cardio, kiné, psy…)" className="flex-1 bg-transparent outline-none text-ink placeholder:text-ink-mute" />
                </div>
              </div>
              <div className="overflow-y-auto overscroll-none px-5 pb-6">
                {groups.length === 0 && <p className="text-sm text-ink-mute py-6 text-center">Aucun résultat.</p>}
                {groups.map(([group, items]) => (
                  <div key={group} className="mb-4">
                    <p className="text-[11px] font-bold tracking-widest uppercase text-ink-mute px-1 mb-1.5">{group}</p>
                    <div className="card divide-y divide-black/5">
                      {items.map((name) => (
                        <button key={name} onClick={() => { onChange(name); setOpen(false); }} className="w-full flex items-center gap-2 px-4 py-3 text-left">
                          <span className="flex-1 font-semibold text-ink text-[15px]">{name}</span>
                          {value === name && <Check className="h-4 w-4 text-brand-600" strokeWidth={3} />}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
