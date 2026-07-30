"use client";

import { useEffect, useState } from "react";
import { getSettings } from "@/lib/storage";
import { verifyPin, verifyFace, unlockSession, biometricsAvailable } from "@/lib/security";
import { Delete, ScanFace } from "lucide-react";

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const s = getSettings();
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);
  const canFace = !!s.faceId && biometricsAvailable();

  const tryFace = async () => {
    if (await verifyFace()) { unlockSession(); onUnlock(); }
  };
  useEffect(() => { if (canFace) tryFace(); /* auto-prompt once */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (code: string) => {
    if (await verifyPin(code)) { unlockSession(); onUnlock(); }
    else { setErr(true); setTimeout(() => { setErr(false); setPin(""); }, 500); }
  };
  const press = (d: string) => {
    if (pin.length >= 4) return;
    const next = pin + d; setPin(next);
    if (next.length === 4) submit(next);
  };
  const back = () => setPin((p) => p.slice(0, -1));

  return (
    <div className="fixed inset-0 z-[100] bg-cream flex flex-col items-center justify-center px-8 pt-safe pb-safe">
      <img src="./brand/moody-icon.png" alt="" className="h-20 w-20 rounded-3xl shadow-card mb-5" />
      <h1 className="font-display text-2xl font-semibold text-ink">Bon retour</h1>
      <p className="text-ink-mute text-sm mb-8">{s.name ? `${s.name}, entre` : "Entre"} ton code pour continuer</p>

      {/* dots */}
      <div className={`flex gap-4 mb-10 ${err ? "animate-[shake_.4s]" : ""}`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-4 w-4 rounded-full transition-all ${i < pin.length ? "bg-brand-500 scale-100" : "bg-black/12 scale-90"} ${err ? "bg-red-400" : ""}`} />
        ))}
      </div>

      {/* keypad */}
      <div className="grid grid-cols-3 gap-4">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} onClick={() => press(d)} className="h-16 w-16 rounded-full bg-white shadow-card font-display text-2xl font-semibold text-ink active:scale-90 active:bg-brand-50 transition">{d}</button>
        ))}
        <button onClick={canFace ? tryFace : undefined} className={`h-16 w-16 rounded-full grid place-items-center ${canFace ? "text-brand-600 active:scale-90" : "opacity-0 pointer-events-none"}`} aria-label="Face ID">
          <ScanFace className="h-7 w-7" />
        </button>
        <button onClick={() => press("0")} className="h-16 w-16 rounded-full bg-white shadow-card font-display text-2xl font-semibold text-ink active:scale-90 active:bg-brand-50 transition">0</button>
        <button onClick={back} className="h-16 w-16 rounded-full grid place-items-center text-ink-soft active:scale-90" aria-label="Effacer"><Delete className="h-6 w-6" /></button>
      </div>

      <style>{`@keyframes shake{10%,90%{transform:translateX(-2px)}20%,80%{transform:translateX(4px)}30%,50%,70%{transform:translateX(-8px)}40%,60%{transform:translateX(8px)}}`}</style>
    </div>
  );
}
