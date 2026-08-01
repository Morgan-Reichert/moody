"use client";

import { useEffect, useRef } from "react";
import { onChange } from "@/lib/storage";
import { initNative, syncNative, isNative } from "@/lib/native";

/** On native (Capacitor), schedules OS notifications so reminders fire even when the app is closed. */
export function NativeBridge() {
  const t = useRef<number | null>(null);
  useEffect(() => {
    if (!isNative()) return;
    initNative().then(syncNative).catch(() => {});
    return onChange(() => {
      if (t.current) clearTimeout(t.current);
      t.current = window.setTimeout(() => { syncNative().catch(() => {}); }, 800);
    });
  }, []);
  return null;
}
