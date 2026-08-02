import { Capacitor } from "@capacitor/core";
import { getSettings, saveSettings } from "./storage";

const UNLOCK_KEY = "moody_unlocked";
const isNative = () => { try { return Capacitor.isNativePlatform(); } catch { return false; } };

// ── base64url helpers ────────────────────────────────────────────────────────
function bufToB64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = ""; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlToBuf(s: string): ArrayBuffer {
  s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "=";
  const bin = atob(s); const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
function randHex(n = 16): string {
  const b = new Uint8Array(n); crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function sha256Hex(str: string): Promise<string> {
  const data = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── PIN ──────────────────────────────────────────────────────────────────────
export async function setPin(pin: string): Promise<void> {
  const salt = randHex();
  const hash = await sha256Hex(salt + pin);
  saveSettings({ pinEnabled: true, pinHash: hash, pinSalt: salt });
  sessionStorage.setItem(UNLOCK_KEY, "1");
}
export async function verifyPin(pin: string): Promise<boolean> {
  const s = getSettings();
  if (!s.pinHash || !s.pinSalt) return false;
  return (await sha256Hex(s.pinSalt + pin)) === s.pinHash;
}
export function disableSecurity(): void {
  saveSettings({ pinEnabled: false, pinHash: undefined, pinSalt: undefined, faceId: false, faceCredId: undefined });
  sessionStorage.setItem(UNLOCK_KEY, "1");
}

// ── session lock ─────────────────────────────────────────────────────────────
export function isLocked(): boolean {
  if (typeof window === "undefined") return false;
  return !!getSettings().pinEnabled && sessionStorage.getItem(UNLOCK_KEY) !== "1";
}
export function unlockSession(): void { sessionStorage.setItem(UNLOCK_KEY, "1"); }
export function lockNow(): void { sessionStorage.removeItem(UNLOCK_KEY); }

// ── Face ID / biometrics ─────────────────────────────────────────────────────
// Native (iOS/Android): the OS LocalAuthentication via @aparajita/capacitor-biometric-auth.
// Web: WebAuthn platform authenticator.
export function biometricsAvailable(): boolean {
  if (isNative()) return true; // real availability is checked at register time
  return typeof window !== "undefined" && !!(window as any).PublicKeyCredential && !!navigator.credentials;
}
export async function registerFace(): Promise<boolean> {
  if (isNative()) {
    try {
      const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
      const info = await BiometricAuth.checkBiometry();
      if (!info.isAvailable) return false;
      await BiometricAuth.authenticate({
        reason: "Confirme pour activer le déverrouillage biométrique",
        cancelTitle: "Annuler",
        iosFallbackTitle: "Utiliser le code",
        allowDeviceCredential: false,
      });
      saveSettings({ faceId: true, faceCredId: "native" });
      return true;
    } catch { return false; }
  }
  if (!biometricsAvailable()) return false;
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "Moody", id: location.hostname },
        user: { id: userId, name: "moody", displayName: "Moody" },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
        timeout: 60000,
        attestation: "none",
      },
    })) as PublicKeyCredential | null;
    if (!cred) return false;
    saveSettings({ faceId: true, faceCredId: bufToB64url(cred.rawId) });
    return true;
  } catch { return false; }
}
export async function verifyFace(): Promise<boolean> {
  const s = getSettings();
  if (!s.faceCredId) return false;
  if (isNative()) {
    try {
      const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
      await BiometricAuth.authenticate({
        reason: "Déverrouille Moody",
        cancelTitle: "Annuler",
        iosFallbackTitle: "Utiliser le code",
        allowDeviceCredential: true,
      });
      return true;
    } catch { return false; }
  }
  if (!biometricsAvailable()) return false;
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ type: "public-key", id: b64urlToBuf(s.faceCredId) }],
        userVerification: "required",
        timeout: 60000,
      },
    });
    return !!assertion; // browser only returns after successful biometric
  } catch { return false; }
}
