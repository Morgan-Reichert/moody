"use client";

import { useState } from "react";
import { Cloud, Copy, Check, RefreshCw, Eye, EyeOff, ShieldCheck, DownloadCloud } from "lucide-react";
import {
  isCloudEnabled, setCloudEnabled, getBackupCode, lastSynced,
  cloudPush, cloudRestore, cloudAvailable,
} from "@/lib/cloud";
import { hTap } from "@/lib/haptics";

function ago(iso: string | null): string {
  if (!iso) return "jamais";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return `il y a ${Math.floor(s / 86400)} j`;
}

export function CloudBackupCard() {
  const [enabled, setEnabled] = useState(isCloudEnabled());
  const [code, setCode] = useState(isCloudEnabled() ? getBackupCode() : "");
  const [reveal, setReveal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [synced, setSynced] = useState(lastSynced());
  const [busy, setBusy] = useState(false);
  const [restoreCode, setRestoreCode] = useState("");
  const [msg, setMsg] = useState("");

  if (!cloudAvailable()) return null;

  const toggle = () => {
    hTap();
    const next = !enabled;
    setCloudEnabled(next);
    setEnabled(next);
    setMsg("");
    if (next) { setCode(getBackupCode()); setReveal(true); setTimeout(() => setSynced(lastSynced()), 1500); }
  };
  const syncNow = async () => {
    setBusy(true); const ok = await cloudPush(); setBusy(false);
    setSynced(lastSynced()); setMsg(ok ? "Sauvegardé en ligne ✓" : "Échec de la sauvegarde — réessaie.");
  };
  const copy = async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* */ } };
  const doRestore = async () => {
    if (!restoreCode.trim()) return;
    if (!confirm("Restaurer depuis ce code ? Tes données actuelles sur cet appareil seront remplacées.")) return;
    setBusy(true); const r = await cloudRestore(restoreCode); setBusy(false);
    if (r === "ok") { setMsg("Restauré ✓ — rechargement…"); setTimeout(() => location.reload(), 900); return; }
    setMsg(r === "not_found" ? "Aucune sauvegarde trouvée pour ce code." : r === "bad_code" ? "Format de code invalide." : "Code incorrect ou erreur réseau.");
  };

  return (
    <section>
      <div className="flex items-center gap-2 mb-2 px-1">
        <Cloud className="h-4 w-4 text-brand-600" />
        <div>
          <h3 className="font-display text-[15px] font-semibold text-ink leading-none">Sauvegarde en ligne</h3>
          <p className="text-[12px] text-ink-mute mt-0.5">Chiffrée · retrouve tes données après une réinstallation</p>
        </div>
      </div>

      <div className="card p-4 space-y-3">
        {/* enable toggle */}
        <button onClick={toggle} className="w-full flex items-center gap-3 text-left">
          <span className={`grid place-items-center h-10 w-10 rounded-2xl shrink-0 ${enabled ? "bg-brand-500 text-white" : "bg-brand-50 text-brand-700"}`}><Cloud className="h-5 w-5" /></span>
          <span className="flex-1">
            <span className="font-bold text-ink text-[14.5px] block">{enabled ? "Sauvegarde activée" : "Activer la sauvegarde cloud"}</span>
            <span className="text-[12px] text-ink-mute">{enabled ? `Dernière synchro ${ago(synced)}` : "Synchro automatique à chaque changement"}</span>
          </span>
          <span className={`relative h-6 w-10 rounded-full transition ${enabled ? "bg-brand-500" : "bg-black/15"}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? "left-[18px]" : "left-0.5"}`} />
          </span>
        </button>

        {enabled && (
          <>
            {/* recovery code */}
            <div className="rounded-2xl bg-brand-50 p-3.5">
              <p className="text-[11px] font-bold tracking-widest uppercase text-brand-700/80 mb-1.5 flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Ton code de récupération</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-display font-semibold text-ink text-[15px] tracking-wide truncate">{reveal ? code : "MOODY-••••-••••-••••-••••"}</code>
                <button onClick={() => setReveal((r) => !r)} className="grid place-items-center h-8 w-8 rounded-lg text-ink-soft active:scale-90" aria-label="Afficher">{reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                <button onClick={copy} className="grid place-items-center h-8 w-8 rounded-lg text-brand-700 active:scale-90" aria-label="Copier">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button>
              </div>
              <p className="text-[11.5px] text-[#c0402a] font-semibold mt-2">Note-le en lieu sûr : c'est la seule clé pour restaurer tes données.</p>
            </div>

            <button onClick={syncNow} disabled={busy} className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 bg-brand-500 text-white font-bold text-sm active:scale-[.98] disabled:opacity-60">
              <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Sauvegarder maintenant
            </button>
          </>
        )}

        {/* restore from a code (available even if not enabled — e.g. fresh install) */}
        <div className="pt-1 border-t border-black/5">
          <p className="text-[12.5px] font-semibold text-ink-soft mt-2 mb-2">Restaurer depuis un code</p>
          <div className="flex items-center gap-2">
            <input value={restoreCode} onChange={(e) => setRestoreCode(e.target.value)} placeholder="MOODY-XXXX-XXXX-XXXX-XXXX"
              className="flex-1 min-w-0 bg-brand-50 rounded-xl px-3 py-2.5 text-ink outline-none text-[13.5px] uppercase" autoCapitalize="characters" autoCorrect="off" />
            <button onClick={doRestore} disabled={busy} className="grid place-items-center h-11 w-11 rounded-xl bg-white shadow-card text-brand-700 shrink-0 active:scale-95 disabled:opacity-60" aria-label="Restaurer"><DownloadCloud className="h-5 w-5" /></button>
          </div>
        </div>

        {msg && <p className="text-[13px] font-semibold text-brand-700 px-1">{msg}</p>}
      </div>
    </section>
  );
}
