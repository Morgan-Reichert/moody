"use client";

import { useMemo, useState } from "react";
import { searchPathologies } from "@/lib/pathologies";
import { Portal } from "@/components/Portal";
import { Search, X, Check, Plus, Activity } from "lucide-react";

export function PathologyPicker({ values, onChange }: { values: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const res = searchPathologies(q);
    const map = new Map<string, string[]>();
    for (const p of res) { if (!map.has(p.group)) map.set(p.group, []); map.get(p.group)!.push(p.name); }
    return Array.from(map.entries());
  }, [q]);
  const toggle = (name: string) => onChange(values.includes(name) ? values.filter((v) => v !== name) : [...values, name]);

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1.5 bg-cream text-ink rounded-full pl-3 pr-1.5 py-1.5 text-[12.5px] font-semibold">
            {v}
            <button onClick={() => toggle(v)} className="grid place-items-center h-5 w-5 rounded-full text-ink-mute"><X className="h-3.5 w-3.5" /></button>
          </span>
        ))}
        <button onClick={() => { setOpen(true); setQ(""); }} className="inline-flex items-center gap-1 rounded-full bg-white shadow-card px-3 py-1.5 text-[12.5px] font-bold text-brand-700 active:scale-95"><Plus className="h-4 w-4" /> Ajouter</button>
      </div>

      {open && (
        <Portal>
          <div className="fixed inset-0 z-[90] flex flex-col justify-end" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <div className="relative bg-cream rounded-t-4xl max-h-[85vh] flex flex-col animate-sheetUp pb-safe">
              <div className="px-5 pt-3 pb-2">
                <div className="mx-auto h-1.5 w-10 rounded-full bg-black/10 mb-3" />
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display text-lg font-semibold text-ink">Pathologies</h2>
                  <button onClick={() => setOpen(false)} className="grid place-items-center h-9 w-9 rounded-xl bg-white shadow-card text-ink-soft active:scale-95"><X className="h-5 w-5" /></button>
                </div>
                <div className="flex items-center gap-2 bg-white rounded-2xl px-3.5 py-3 shadow-card">
                  <Search className="h-4 w-4 text-ink-mute" />
                  <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (diabète, asthme, migraine…)" className="flex-1 bg-transparent outline-none text-ink placeholder:text-ink-mute" />
                </div>
              </div>
              <div className="overflow-y-auto overscroll-none px-5 pb-6">
                {groups.length === 0 && <p className="text-sm text-ink-mute py-6 text-center">Aucun résultat.</p>}
                {groups.map(([group, items]) => (
                  <div key={group} className="mb-4">
                    <p className="text-[11px] font-bold tracking-widest uppercase text-ink-mute px-1 mb-1.5">{group}</p>
                    <div className="card divide-y divide-black/5">
                      {items.map((name) => {
                        const on = values.includes(name);
                        return (
                          <button key={name} onClick={() => toggle(name)} className="w-full flex items-center gap-2 px-4 py-3 text-left">
                            <Activity className="h-4 w-4 text-brand-500 shrink-0" />
                            <span className="flex-1 font-semibold text-ink text-[14px]">{name}</span>
                            {on && <Check className="h-4 w-4 text-brand-600" strokeWidth={3} />}
                          </button>
                        );
                      })}
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
