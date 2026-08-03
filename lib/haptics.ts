import { Capacitor } from "@capacitor/core";

const native = () => { try { return Capacitor.isNativePlatform(); } catch { return false; } };

/** Light tap — buttons, toggles, checking a medication. */
export async function hTap(): Promise<void> {
  if (native()) {
    try { const { Haptics, ImpactStyle } = await import("@capacitor/haptics"); await Haptics.impact({ style: ImpactStyle.Light }); return; } catch { /* */ }
  }
  try { navigator.vibrate?.(8); } catch { /* */ }
}

/** Selection change — switching a tab, picking a mood face. */
export async function hSelect(): Promise<void> {
  if (native()) {
    try { const { Haptics } = await import("@capacitor/haptics"); await Haptics.selectionChanged(); return; } catch { /* */ }
  }
  try { navigator.vibrate?.(6); } catch { /* */ }
}

/** Success notification — saving an entry. */
export async function hSuccess(): Promise<void> {
  if (native()) {
    try { const { Haptics, NotificationType } = await import("@capacitor/haptics"); await Haptics.notification({ type: NotificationType.Success }); return; } catch { /* */ }
  }
  try { navigator.vibrate?.([10, 40, 10]); } catch { /* */ }
}
