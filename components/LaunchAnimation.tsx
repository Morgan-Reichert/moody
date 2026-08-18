"use client";

import { useEffect, useState } from "react";

/** Animated launch overlay (logo icon) shown briefly on app start, then fades out.
 *  Self-managing so it can sit in the root layout, above everything. */
export function LaunchAnimation() {
  const [show, setShow] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 1500);
    const t2 = setTimeout(() => setShow(false), 2050);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col items-center justify-center transition-opacity duration-500"
      style={{ background: "#eef2ec", opacity: leaving ? 0 : 1, pointerEvents: leaving ? "none" : "auto" }}
    >
      <div className="relative grid place-items-center">
        <span className="absolute rounded-full moody-ring" />
        <span className="absolute rounded-full moody-ring moody-ring-2" />
        <img src="/brand/moody-icon.png" alt="Moody" className="relative h-28 w-28 rounded-[28px] shadow-[0_16px_40px_-14px_rgba(20,50,35,.4)] moody-pop" />
      </div>
      <img src="/brand/moody-wordmark-tight.png" alt="" className="h-7 mt-7 moody-fadeup" />

      <style>{`
        .moody-pop { animation: moodyPop .65s cubic-bezier(.34,1.56,.64,1) both; }
        .moody-ring { height:7rem; width:7rem; background: rgba(26,173,85,.18); animation: moodyRing 1.8s ease-out infinite; }
        .moody-ring-2 { animation-delay: .6s; }
        .moody-fadeup { opacity:0; animation: moodyFade .6s ease-out .4s forwards; }
        @keyframes moodyPop { 0%{transform:scale(.55);opacity:0} 60%{opacity:1} 100%{transform:scale(1);opacity:1} }
        @keyframes moodyRing { 0%{transform:scale(.8);opacity:.55} 100%{transform:scale(2.1);opacity:0} }
        @keyframes moodyFade { 0%{transform:translateY(10px);opacity:0} 100%{transform:translateY(0);opacity:1} }
        @media (prefers-reduced-motion: reduce){ .moody-pop,.moody-ring,.moody-fadeup{animation:none;opacity:1} }
      `}</style>
    </div>
  );
}
