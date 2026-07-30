"use client";

import { useEffect, useRef, useState } from "react";
import { Portal } from "@/components/Portal";
import { vibrate } from "@/lib/reminders";
import { X, Play } from "lucide-react";

const CYCLE = 5000; // 5s inhale / 5s exhale (cohérence cardiaque)

export function BreathingModal({ onClose }: { onClose: () => void }) {
  const [started, setStarted] = useState(false);
  const [minutes, setMinutes] = useState(3);
  const [phase, setPhase] = useState<"in" | "out">("in");
  const [left, setLeft] = useState(0);
  const cycleRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);

  const start = () => {
    setStarted(true); setLeft(minutes * 60); setPhase("in"); vibrate(20);
    cycleRef.current = window.setInterval(() => { setPhase((p) => (p === "in" ? "out" : "in")); vibrate(15); }, CYCLE);
    tickRef.current = window.setInterval(() => setLeft((l) => { if (l <= 1) { stop(); return 0; } return l - 1; }), 1000);
  };
  const stop = () => {
    if (cycleRef.current) clearInterval(cycleRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
  };
  useEffect(() => () => stop(), []);

  const mm = String(Math.floor(left / 60)).padStart(1, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <Portal>
      <div className="fixed inset-0 z-[85] bg-gradient-to-b from-brand-600 to-brand-700 text-white flex flex-col items-center justify-center px-6 pt-safe pb-safe">
        <button onClick={() => { stop(); onClose(); }} className="absolute top-safe right-5 mt-3 grid place-items-center h-11 w-11 rounded-2xl bg-white/15 active:scale-95"><X className="h-5 w-5" /></button>

        {!started ? (
          <div className="text-center max-w-xs">
            <h1 className="font-display text-3xl font-semibold">Respire un instant</h1>
            <p className="text-white/80 mt-2">Cohérence cardiaque : inspire quand la bulle grandit, expire quand elle rétrécit.</p>
            <div className="flex gap-2 justify-center mt-6">
              {[1, 3, 5].map((m) => (
                <button key={m} onClick={() => setMinutes(m)} className={`h-12 w-16 rounded-2xl font-display font-semibold transition ${minutes === m ? "bg-white text-brand-700" : "bg-white/15 text-white"}`}>{m} min</button>
              ))}
            </div>
            <button onClick={start} className="mt-8 inline-flex items-center gap-2 rounded-3xl bg-white text-brand-700 font-display text-[17px] font-semibold px-8 py-4 shadow-glow active:scale-[.98]"><Play className="h-5 w-5" /> Commencer</button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="relative grid place-items-center h-72 w-72">
              <div className="absolute rounded-full bg-white/10" style={{ height: "100%", width: "100%" }} />
              <div
                className="rounded-full bg-white/25 backdrop-blur transition-transform ease-in-out"
                style={{ height: "70%", width: "70%", transform: phase === "in" ? "scale(1)" : "scale(0.5)", transitionDuration: `${CYCLE}ms` }}
              />
              <span className="absolute font-display text-2xl font-semibold">{phase === "in" ? "Inspire" : "Expire"}</span>
            </div>
            <p className="mt-8 font-display text-lg tabular-nums text-white/80">{mm}:{ss}</p>
            <button onClick={() => { stop(); onClose(); }} className="mt-4 text-white/70 font-semibold text-sm">Terminer</button>
          </div>
        )}
      </div>
    </Portal>
  );
}
