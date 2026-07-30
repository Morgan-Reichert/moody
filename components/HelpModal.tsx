"use client";

import { useState } from "react";
import { getSettings, saveSettings } from "@/lib/storage";
import { COUNTRIES, linesFor, countryFromPosition } from "@/lib/helplines";
import { Portal } from "@/components/Portal";
import { X, Phone, HeartHandshake, MapPin, Loader2, Globe, ExternalLink } from "lucide-react";

export function HelpModal({ onClose }: { onClose: () => void }) {
  const [country, setCountry] = useState<string | undefined>(() => getSettings().country);
  const [phase, setPhase] = useState<"choose" | "pick" | "list">(country ? "list" : "choose");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const choose = (code: string) => { saveSettings({ country: code }); setCountry(code); setPhase("list"); };
  const useLocation = async () => {
    setLoading(true); setErr("");
    try { const code = await countryFromPosition(); if (code) choose(code); else { setErr("Localisation indisponible."); setPhase("pick"); } }
    catch { setErr("Localisation refusée. Choisis ton pays."); setPhase("pick"); }
    finally { setLoading(false); }
  };

  const info = linesFor(country);

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
            <p className="text-[14px] text-ink-soft">Tu n'es pas seul·e. Si ça ne va pas, parler à quelqu'un aide vraiment. Ces lignes sont gratuites.</p>

            {phase === "choose" && (
              <div className="space-y-2.5 pt-1">
                <p className="text-[13px] text-ink-mute">Pour t'indiquer les bons numéros, on a besoin de ton pays.</p>
                <button onClick={useLocation} disabled={loading} className="w-full rounded-3xl py-4 bg-brand-500 text-white font-display text-[16px] font-semibold shadow-glow flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[.99]">
                  {loading ? <><Loader2 className="h-5 w-5 animate-spin" /> Localisation…</> : <><MapPin className="h-5 w-5" /> Activer ma localisation</>}
                </button>
                <button onClick={() => setPhase("pick")} className="w-full rounded-3xl py-3.5 bg-white shadow-card text-ink-soft font-semibold flex items-center justify-center gap-2 active:scale-[.99]"><Globe className="h-5 w-5" /> Choisir mon pays</button>
                {err && <p className="text-sm text-red-500 px-1">{err}</p>}
              </div>
            )}

            {phase === "pick" && (
              <div className="space-y-2 pt-1">
                {COUNTRIES.map((c) => (
                  <button key={c.code} onClick={() => choose(c.code)} className="card w-full p-3.5 flex items-center gap-3 text-left active:scale-[.99]">
                    <span className="text-2xl">{c.flag}</span><span className="flex-1 font-bold text-ink">{c.name}</span>
                  </button>
                ))}
                <button onClick={() => choose("XX")} className="card w-full p-3.5 flex items-center gap-3 text-left active:scale-[.99]">
                  <Globe className="h-6 w-6 text-brand-600" /><span className="flex-1 font-bold text-ink">Autre pays / international</span>
                </button>
              </div>
            )}

            {phase === "list" && (
              <>
                {info.lines.map((r) => (
                  r.tel
                    ? <a key={r.name} href={`tel:${r.tel}`} className="card p-4 flex items-center gap-3.5 active:scale-[.99]">
                        <span className="grid place-items-center h-12 w-12 rounded-2xl bg-brand-500 text-white shrink-0"><Phone className="h-6 w-6" /></span>
                        <div className="flex-1 min-w-0"><p className="font-bold text-ink text-[15px]">{r.name}</p><p className="text-[12.5px] text-ink-mute">{r.desc}</p></div>
                        <Phone className="h-5 w-5 text-brand-600" />
                      </a>
                    : <a key={r.name} href="https://findahelpline.com" target="_blank" rel="noreferrer" className="card p-4 flex items-center gap-3.5 active:scale-[.99]">
                        <span className="grid place-items-center h-12 w-12 rounded-2xl bg-lilac text-brand-700 shrink-0"><Globe className="h-6 w-6" /></span>
                        <div className="flex-1 min-w-0"><p className="font-bold text-ink text-[15px]">{r.name}</p><p className="text-[12.5px] text-ink-mute">{r.desc}</p></div>
                        <ExternalLink className="h-5 w-5 text-brand-600" />
                      </a>
                ))}
                <button onClick={() => setPhase("pick")} className="w-full text-center text-[12.5px] font-semibold text-ink-mute pt-1">Pays : {info.name} — changer</button>
                <p className="text-[11.5px] text-ink-mute text-center">En cas de danger immédiat, appelle le numéro d'urgence de ton pays.</p>
              </>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
