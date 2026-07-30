"use client";

import { useEffect, useRef, useState } from "react";
import { X, ScanLine, CameraOff } from "lucide-react";

export function BarcodeScanner({
  title, expected, onResult, onClose, allowSkip,
}: {
  title: string;
  expected?: string;           // when set, only a matching code is accepted
  onResult: (code: string) => void;
  onClose: () => void;
  allowSkip?: boolean;         // show an escape hatch (e.g. no camera)
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wrong, setWrong] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    let stopped = false;
    const Detector = (window as any).BarcodeDetector;
    if (!Detector) setSupported(false);

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } }, audio: false,
        });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        setError("Caméra indisponible. Autorise l'accès ou valide manuellement.");
        return;
      }

      if (!Detector) return;
      const detector = new Detector({ formats: ["ean_13", "ean_8", "code_128", "upc_a", "upc_e", "qr_code", "code_39"] });
      const scan = async () => {
        if (stopped || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes && codes.length) {
            const value = codes[0].rawValue as string;
            if (expected && value !== expected) {
              setWrong(true);
              setTimeout(() => setWrong(false), 1500);
            } else {
              cleanup();
              onResult(value);
              return;
            }
          }
        } catch { /* frame not ready */ }
        rafRef.current = window.setTimeout(scan, 350) as unknown as number;
      };
      scan();
    })();

    const cleanup = () => {
      stopped = true;
      if (rafRef.current) clearTimeout(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[80] bg-black flex flex-col" role="dialog" aria-modal="true">
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        {/* frame overlay */}
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className={`h-56 w-72 rounded-3xl border-4 ${wrong ? "border-red-400" : "border-white/90"} shadow-[0_0_0_9999px_rgba(0,0,0,.45)]`} />
        </div>
        {(error || !supported) && (
          <div className="absolute inset-0 grid place-items-center p-8 text-center">
            <div className="text-white/90">
              <CameraOff className="h-10 w-10 mx-auto mb-3 opacity-80" />
              <p className="text-sm">{error ?? "Le scan de code-barres n'est pas supporté par ce navigateur."}</p>
            </div>
          </div>
        )}
      </div>

      <div className="pb-safe px-6 pt-5 bg-black text-white">
        <div className="flex items-center gap-2 justify-center mb-1">
          <ScanLine className="h-5 w-5 text-brand-300" />
          <p className="font-display text-lg font-semibold">{title}</p>
        </div>
        <p className="text-center text-white/60 text-sm mb-4">
          {wrong ? "Ce n'est pas le bon médicament." : "Place le code-barres dans le cadre."}
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-2xl py-3.5 bg-white/10 text-white font-semibold flex items-center justify-center gap-2">
            <X className="h-5 w-5" /> Annuler
          </button>
          {(allowSkip || !supported || error) && (
            <button
              onClick={() => onResult(expected ?? "__skip__")}
              className="flex-1 rounded-2xl py-3.5 bg-brand-500 text-white font-semibold"
            >
              Valider sans scan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
