"use client";

import { useState } from "react";
import { searchCatalog } from "@/lib/meds-catalog";
import { MedHighlights } from "@/lib/storage";
import { Pill, Info } from "lucide-react";

export function MedAutocomplete({
  value, onChange, onBlur, onPick, placeholder = "Nom du médicament",
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  onPick: (name: string, h?: MedHighlights) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const sugg = open ? searchCatalog(value) : [];

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { setTimeout(() => setOpen(false), 150); onBlur?.(); }}
        placeholder={placeholder}
        className="w-full bg-brand-50 rounded-xl px-3.5 py-2.5 font-semibold text-ink outline-none"
      />
      {open && sugg.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white rounded-2xl shadow-soft border border-black/5 overflow-hidden max-h-60 overflow-y-auto">
          {sugg.map((s) => (
            <button
              key={s.name}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onPick(s.name, s.h); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-brand-50 active:bg-brand-50"
            >
              <Pill className="h-4 w-4 text-brand-600 shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="font-semibold text-ink text-[14px] block truncate">{s.name}</span>
                {s.h?.molecule && <span className="text-[11.5px] text-ink-mute">{s.h.molecule}{s.h.classe ? ` · ${s.h.classe}` : ""}</span>}
              </span>
              {s.h && <Info className="h-3.5 w-3.5 text-brand-400 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
