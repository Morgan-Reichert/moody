"use client";

import { useEffect, useRef, useState } from "react";
import { getSettings, getMeds, markReminder } from "@/lib/storage";
import { dueReminders, DueReminder, Alarm, notify, vibrate } from "@/lib/reminders";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { Portal } from "@/components/Portal";
import { Smile, Pill, ScanLine, Check, Clock } from "lucide-react";

export function ReminderEngine({ onOpenMood }: { onOpenMood: () => void }) {
  const [active, setActive] = useState<DueReminder | null>(null);
  const [scanning, setScanning] = useState(false);
  const alarmRef = useRef<Alarm | null>(null);
  const snoozeRef = useRef<Record<string, number>>({});
  const activeRef = useRef<DueReminder | null>(null);
  activeRef.current = active;

  // Prime the audio context on the first user gesture (browsers block autoplay).
  useEffect(() => {
    const prime = () => {
      try { const c = new (window.AudioContext || (window as any).webkitAudioContext)(); c.resume(); c.close(); } catch {}
      window.removeEventListener("pointerdown", prime);
    };
    window.addEventListener("pointerdown", prime, { once: true });
    return () => window.removeEventListener("pointerdown", prime);
  }, []);

  // Scheduler loop.
  useEffect(() => {
    const check = () => {
      if (activeRef.current) return;                 // one alarm at a time
      const settings = getSettings();
      const meds = getMeds();
      const now = new Date();
      const due = dueReminders(settings, meds, now);
      for (const d of due) {
        const snoozeUntil = snoozeRef.current[d.slot];
        if (snoozeUntil && now.getTime() < snoozeUntil) continue;
        // Already handled this slot today (and not currently snoozed) → skip.
        // markReminder is our per-slot "seen" flag; snooze re-opens it explicitly.
        if (!snoozeUntil && isHandledToday(d.slot)) continue;
        trigger(d, settings.loudAlarm);
        break;
      }
    };
    const id = window.setInterval(check, 10000);
    check();
    // fire again when the app returns to foreground
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handledRef = useRef<Set<string>>(new Set());
  const isHandledToday = (slot: string) => handledRef.current.has(slot);

  const trigger = (d: DueReminder, loud: boolean) => {
    markReminder(d.slot);
    handledRef.current.add(d.slot);
    delete snoozeRef.current[d.slot];
    setActive(d);
    notify(d.title, d.body);
    vibrate([300, 120, 300]);
    const alarm = new Alarm(loud && d.kind === "med");
    alarm.start();
    alarmRef.current = alarm;
  };

  const stopSound = () => { alarmRef.current?.stop(); alarmRef.current = null; };

  const validate = () => {
    stopSound();
    if (active?.kind === "mood") onOpenMood();
    setActive(null);
  };
  const snooze = () => {
    if (active) {
      const mins = getSettings().snoozeMinutes;
      snoozeRef.current[active.slot] = Date.now() + mins * 60000;
      handledRef.current.delete(active.slot);
    }
    stopSound();
    setActive(null);
  };

  if (!active) return null;

  const settings = getSettings();
  const isMed = active.kind === "med";
  const requireScan = isMed && settings.scanToDismiss;

  return (
    <Portal>
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center p-6 bg-ink/70 backdrop-blur-md">
      <div className="w-full max-w-sm rounded-4xl bg-cream p-7 text-center shadow-pill animate-pop">
        <div className="mx-auto grid place-items-center h-20 w-20 rounded-full bg-brand-500 text-white animate-pulseRing shadow-glow">
          {isMed ? <Pill className="h-9 w-9" /> : <Smile className="h-9 w-9" />}
        </div>
        <h2 className="font-display text-2xl font-semibold text-ink mt-5">{active.title}</h2>
        <p className="text-ink-soft mt-1.5">{active.body}</p>
        <p className="text-[13px] text-ink-mute mt-1 tabular-nums">Rappel de {active.time}</p>

        <div className="mt-6 space-y-2.5">
          {requireScan ? (
            <>
              <button onClick={() => setScanning(true)}
                className="w-full rounded-3xl py-4 bg-brand-500 text-white font-display text-[17px] font-semibold flex items-center justify-center gap-2 shadow-glow active:scale-[.99]">
                <ScanLine className="h-5 w-5" /> Scanner pour couper
              </button>
              <button onClick={snooze} className="w-full rounded-3xl py-3 text-ink-mute font-semibold text-sm inline-flex items-center justify-center gap-1.5">
                <Clock className="h-4 w-4" /> Plus tard ({settings.snoozeMinutes} min)
              </button>
            </>
          ) : (
            <>
              <button onClick={validate}
                className="w-full rounded-3xl py-4 bg-brand-500 text-white font-display text-[17px] font-semibold flex items-center justify-center gap-2 shadow-glow active:scale-[.99]">
                <Check className="h-5 w-5" strokeWidth={2.6} /> {isMed ? "J'ai pris" : "Noter mon humeur"}
              </button>
              <button onClick={snooze} className="w-full rounded-3xl py-3.5 bg-white shadow-card text-ink-soft font-semibold inline-flex items-center justify-center gap-1.5 active:scale-[.99]">
                <Clock className="h-4 w-4" /> Plus tard ({settings.snoozeMinutes} min)
              </button>
            </>
          )}
        </div>
      </div>

      {scanning && (
        <BarcodeScanner
          title="Scanne ton médicament"
          expected={active.barcode}
          allowSkip={!active.barcode}
          onResult={() => { setScanning(false); validate(); }}
          onClose={() => setScanning(false)}
        />
      )}
    </div>
    </Portal>
  );
}
