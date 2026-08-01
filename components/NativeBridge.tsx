"use client";

import { useEffect, useRef } from "react";
import { onChange } from "@/lib/storage";
import { initNative, syncNative, isNative } from "@/lib/native";

/** On native (Capacitor): schedules OS notifications (fire even when app is closed) and,
 *  when a medication notification is tapped, triggers the in-app loud alarm + scan-to-dismiss. */
export function NativeBridge() {
  const t = useRef<number | null>(null);
  useEffect(() => {
    if (!isNative()) return;
    let cleanupTap: (() => void) | undefined;

    (async () => {
      await initNative().catch(() => {});
      await syncNative().catch(() => {});
      try {
        const { SplashScreen } = await import("@capacitor/splash-screen");
        SplashScreen.hide().catch(() => {});
      } catch { /* */ }
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
    })();

    const off = onChange(() => {
      if (t.current) clearTimeout(t.current);
      t.current = window.setTimeout(() => { syncNative().catch(() => {}); }, 800);
    });
    return () => { off(); cleanupTap?.(); };
  }, []);
  return null;
}
