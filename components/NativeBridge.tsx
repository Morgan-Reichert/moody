"use client";

import { useEffect, useRef } from "react";
import { onChange } from "@/lib/storage";
import { initNative, syncNative, isNative } from "@/lib/native";
import { pushWidgetData } from "@/lib/widget";

/** On native (Capacitor): schedules OS notifications (fire even when app is closed) and,
 *  when a medication notification is tapped, triggers the in-app loud alarm + scan-to-dismiss. */
export function NativeBridge() {
  const t = useRef<number | null>(null);
  useEffect(() => {
    if (!isNative()) return;
    let cleanupTap: (() => void) | undefined;
    let cleanupUrl: (() => void) | undefined;

    (async () => {
      // Hide the native splash right away so nothing can block the launch.
      try { const { SplashScreen } = await import("@capacitor/splash-screen"); SplashScreen.hide().catch(() => {}); } catch { /* */ }
      await initNative().catch(() => {});
      await syncNative().catch(() => {});
      pushWidgetData().catch(() => {});
      try {
        const { LocalNotifications } = await import("@capacitor/local-notifications");
        const h = await LocalNotifications.addListener("localNotificationActionPerformed", (ev: any) => {
          const extra = ev?.notification?.extra;
          if (extra?.kind === "med" && extra.medId) {
            window.dispatchEvent(new CustomEvent("moody:med-alarm", { detail: { medId: extra.medId } }));
          }
        });
        cleanupTap = () => h.remove();
      } catch { /* */ }
      try {
        const { App } = await import("@capacitor/app");
        const h2 = await App.addListener("appUrlOpen", (ev: any) => {
          const u = (ev?.url || "").toLowerCase();
          if (u.includes("mood")) window.dispatchEvent(new CustomEvent("moody:open-mood"));
        });
        cleanupUrl = () => h2.remove();
      } catch { /* */ }
    })();

    const off = onChange(() => {
      if (t.current) clearTimeout(t.current);
      t.current = window.setTimeout(() => { syncNative().catch(() => {}); pushWidgetData().catch(() => {}); }, 800);
    });
    return () => { off(); cleanupTap?.(); cleanupUrl?.(); };
  }, []);
  return null;
}
