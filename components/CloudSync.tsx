"use client";

import { useEffect } from "react";
import { cloudPush, startCloudAutoSync, isCloudEnabled } from "@/lib/cloud";

/** Mounts the encrypted cloud backup: syncs on launch + on every data change (debounced). */
export function CloudSync() {
  useEffect(() => {
    if (isCloudEnabled()) cloudPush();
    return startCloudAutoSync();
  }, []);
  return null;
}
