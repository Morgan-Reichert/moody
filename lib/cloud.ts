// Encrypted cloud backup — survives reinstalls, bundle-id changes, even a new phone.
// A personal "restore code" both identifies the row and derives the AES-GCM key, so
// Supabase only ever stores ciphertext it cannot read. Lose the code = lose the backup.
import { supabase } from "./supabase";
import { onChange } from "./storage";

const K_CODE = "moody_backup_code";
const K_ENABLED = "moody_cloud_enabled";
const K_SYNCED = "moody_cloud_synced";
// keys that must NOT be backed up / overwritten on restore
const SKIP = new Set([K_CODE, K_ENABLED, K_SYNCED]);

const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I/L

function b64(bytes: Uint8Array): string { let s = ""; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s); }
function unb64(s: string): Uint8Array { const bin = atob(s); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; }
function b64url(bytes: Uint8Array): string { return b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }

function genCode(): string {
  const a = new Uint8Array(16); crypto.getRandomValues(a);
  const g = Array.from(a).map((b) => CHARS[b % CHARS.length]).join("");
  return `MOODY-${g.slice(0, 4)}-${g.slice(4, 8)}-${g.slice(8, 12)}-${g.slice(12, 16)}`;
}
export function normalizeCode(s: string): string { return s.trim().toUpperCase().replace(/\s+/g, ""); }

/** Get the device's backup code, creating one on first call. */
export function getBackupCode(): string {
  let c = "";
  try { c = localStorage.getItem(K_CODE) || ""; } catch { /* */ }
  if (!c) { c = genCode(); try { localStorage.setItem(K_CODE, c); } catch { /* */ } }
  return c;
}
export function isCloudEnabled(): boolean { try { return localStorage.getItem(K_ENABLED) === "1"; } catch { return false; } }
export function setCloudEnabled(on: boolean): void {
  try { localStorage.setItem(K_ENABLED, on ? "1" : "0"); } catch { /* */ }
  if (on) { getBackupCode(); cloudPush(); }
}
export function lastSynced(): string | null { try { return localStorage.getItem(K_SYNCED); } catch { return null; } }
export const cloudAvailable = () => !!supabase;

const bs = (u: Uint8Array): BufferSource => u as unknown as BufferSource;
async function sha256(s: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bs(new TextEncoder().encode(s))));
}
async function rowId(code: string): Promise<string> { return b64url(await sha256(code + "|moody-id")); }
async function deriveKey(code: string): Promise<CryptoKey> {
  const raw = await sha256(code + "|moody-key");
  return crypto.subtle.importKey("raw", bs(raw), "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function encryptData(obj: unknown, code: string): Promise<{ iv: string; cipher: string }> {
  const key = await deriveKey(code);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: bs(iv) }, key, bs(new TextEncoder().encode(JSON.stringify(obj))));
  return { iv: b64(iv), cipher: b64(new Uint8Array(ct)) };
}
async function decryptData(iv: string, cipher: string, code: string): Promise<Record<string, string>> {
  const key = await deriveKey(code);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bs(unb64(iv)) }, key, bs(unb64(cipher)));
  return JSON.parse(new TextDecoder().decode(pt));
}

function collectData(): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    if (k.startsWith("moody_") && !SKIP.has(k)) { const v = localStorage.getItem(k); if (v != null) out[k] = v; }
  }
  return out;
}
function applyData(obj: Record<string, string>): void {
  for (const [k, v] of Object.entries(obj)) if (k.startsWith("moody_") && !SKIP.has(k)) localStorage.setItem(k, v);
}

/** Push an encrypted snapshot to Supabase (no-op if disabled / not configured). */
export async function cloudPush(): Promise<boolean> {
  if (!supabase || !isCloudEnabled()) return false;
  try {
    const code = getBackupCode();
    const id = await rowId(code);
    const { iv, cipher } = await encryptData(collectData(), code);
    const { error } = await supabase.from("backups").upsert({ id, iv, cipher, updated_at: new Date().toISOString() });
    if (error) return false;
    try { localStorage.setItem(K_SYNCED, new Date().toISOString()); } catch { /* */ }
    return true;
  } catch { return false; }
}

export type RestoreResult = "ok" | "not_found" | "bad_code" | "error";
/** Restore from a code entered by the user (wrong code → decryption fails → "error"). */
export async function cloudRestore(codeInput: string): Promise<RestoreResult> {
  if (!supabase) return "error";
  const code = normalizeCode(codeInput);
  if (!/^MOODY-[A-Z0-9-]{10,}$/.test(code)) return "bad_code";
  try {
    const id = await rowId(code);
    const { data, error } = await supabase.from("backups").select("iv,cipher").eq("id", id).maybeSingle();
    if (error) return "error";
    if (!data) return "not_found";
    const obj = await decryptData(data.iv, data.cipher, code);
    applyData(obj);
    try { localStorage.setItem(K_CODE, code); localStorage.setItem(K_ENABLED, "1"); } catch { /* */ }
    return "ok";
  } catch { return "error"; }
}

/** Debounced auto-sync on any data change. Returns an unsubscribe fn. */
export function startCloudAutoSync(): () => void {
  let t: number | null = null;
  const off = onChange(() => {
    if (!isCloudEnabled()) return;
    if (t) clearTimeout(t);
    t = window.setTimeout(() => { cloudPush(); }, 2500);
  });
  return () => { off(); if (t) clearTimeout(t); };
}
