"use client";

import { useEffect, useState } from "react";
import { Landing } from "@/components/Landing";
import { MoodyApp } from "@/components/MoodyApp";
import { isNative } from "@/lib/native";
import { getSettings } from "@/lib/storage";

/**
 * Smart entry:
 *  - native app (Capacitor) → straight to the product
 *  - returning users (already entered or onboarded) → straight to the product
 *  - new web visitors → the showcase landing, with a button to open the beta in place
 * Everything stays at "/" so the app's asset paths and the native build are untouched.
 */
export default function Home() {
  const [view, setView] = useState<"loading" | "landing" | "app">("loading");

  useEffect(() => {
    let entered = false;
    try { entered = localStorage.getItem("moody_entered") === "1"; } catch { /* */ }
    // Installed PWA (standalone) or iOS home-screen app should open the product directly.
    const standalone = typeof window !== "undefined" &&
      (window.matchMedia?.("(display-mode: standalone)").matches || (window.navigator as any).standalone === true);
    if (isNative() || standalone || entered || getSettings().onboarded) setView("app");
    else setView("landing");
  }, []);

  if (view === "loading") return <div className="fixed inset-0 bg-cream" />;
  if (view === "landing") {
    return <Landing onEnter={() => { try { localStorage.setItem("moody_entered", "1"); } catch { /* */ } setView("app"); }} />;
  }
  return <MoodyApp />;
}
