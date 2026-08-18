"use client";

import { useEffect, useState } from "react";
import { getMedicalProfile, getDoctors, getEntries, getSettings, ageFrom, currentTreatments } from "@/lib/storage";
import { listDocs, getDocBlob, DocMeta } from "@/lib/vault-db";
import { listReports, getReportBlob, ReportMeta } from "@/lib/reports-db";
import { createShare, SharePayload } from "@/lib/share";
import { supabaseReady } from "@/lib/supabase";
import { Portal } from "@/components/Portal";
import { X, QrCode, Loader2, Check, ShieldCheck, Copy, UserPlus } from "lucide-react";

export function ShareDoctorModal({ onClose }: { onClose: () => void }) {
  const doctors = getDoctors();
  const [docId, setDocId] = useState("");
  const [guest, setGuest] = useState(false);
  const [infoSheet, setInfoSheet] = useState(true);
  const [infoRx, setInfoRx] = useState(true);
  const [infoSy, setInfoSy] = useState(false);
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<"config" | "qr">("config");
  const [qr, setQr] = useState(""); const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false); const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => { listReports().then(setReports).catch(() => {}); listDocs().then(setDocs).catch(() => {}); }, []);
  const toggle = (k: string) => setSel((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const generate = async () => {
    setLoading(true); setErr("");
    try {
      const prof = getMedicalProfile();
      const settings = getSettings();
      const payload: SharePayload = {
        generatedAt: new Date().toISOString(),
        patientName: prof.fullName || settings.name,
        photo: prof.photo, sex: prof.sex, age: ageFrom(prof.birthDate),
      };
      if (prof.isMinor && (prof.guardianName || prof.guardianPhone)) payload.guardian = { name: prof.guardianName, phone: prof.guardianPhone, relation: prof.guardianRelation };
      if (infoSheet) {
        payload.sheet = {
          conditions: prof.conditionsList && prof.conditionsList.length ? prof.conditionsList.join(", ") : prof.conditions,
          allergies: prof.allergies, bloodType: prof.bloodType, height: prof.height, weight: prof.weight,
        };
        const tr = currentTreatments();
        if (tr.length) payload.treatments = tr.map((t) => ({ name: t.name, dose: t.dose, perDay: t.perDay, timing: t.timing }));
      }
      if (infoRx) payload.prescriptions = docs.filter((d) => d.type === "ordonnance" || d.type === "certificat").map((d) => ({ title: d.title, date: d.date, expiry: d.expiryDate, doctor: d.prescriber }));
      if (infoSy) {
        const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
        payload.symptoms = getEntries().filter((e) => e.symptoms && e.symptoms.length && e.date >= since).map((e) => ({ date: e.date, symptoms: e.symptoms!, intensity: e.symptomIntensity }));
      }
      // gather PDFs
      const pdfs: { name: string; blob: Blob }[] = [];
      for (const key of Array.from(sel)) {
        const [kind, id] = key.split(":");
        if (kind === "report") { const b = await getReportBlob(id); if (b) pdfs.push({ name: reports.find((r) => r.id === id)?.name || "rapport.pdf", blob: b }); }
        else { const r = await getDocBlob(id); if (r) pdfs.push({ name: (docs.find((d) => d.id === id)?.title || "document") + ".pdf", blob: r.blob }); }
      }
      const doctor = doctors.find((d) => d.id === docId);
      const { url } = await createShare(payload, pdfs, { doctorName: doctor?.name, guestAllowed: guest, ttlHours: 24 });
      const QRCode = (await import("qrcode")).default;
      const dataUrl = await QRCode.toDataURL(url, { width: 320, margin: 1, color: { dark: "#16211b", light: "#ffffff" } });
      setQr(dataUrl); setUrl(url); setStep("qr");
    } catch (e: any) {
      setErr(
        e?.message === "not_configured" ? "Le partage médecin n'est pas encore activé (connexion à configurer)."
        : e?.message === "no_public_url" ? "Le lien public n'est pas encore configuré (hébergement de la page de consultation à finaliser)."
        : "Erreur lors de la création du partage.",
      );
    } finally { setLoading(false); }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[80] flex flex-col justify-end" role="dialog" aria-modal="true">
        <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-cream rounded-t-4xl max-h-[92vh] overflow-y-auto overscroll-none animate-sheetUp pb-safe">
          <div className="sticky top-0 bg-cream/95 backdrop-blur px-5 pt-3 pb-3 z-10">
            <div className="mx-auto h-1.5 w-10 rounded-full bg-black/10 mb-3" />
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold text-ink flex items-center gap-2"><QrCode className="h-5 w-5 text-brand-600" /> Partager à un médecin</h2>
              <button onClick={onClose} className="grid place-items-center h-10 w-10 rounded-2xl bg-white shadow-card text-ink-soft active:scale-95"><X className="h-5 w-5" /></button>
            </div>
          </div>

          <div className="px-5 pb-8">
            {!supabaseReady ? (
              <div className="py-8 text-center text-ink-soft">
                <ShieldCheck className="h-10 w-10 mx-auto text-brand-500 mb-3" />
                <p className="font-semibold text-ink">Partage sécurisé à configurer</p>
                <p className="text-sm text-ink-mute mt-1 max-w-xs mx-auto">Ajoute la clé <b>NEXT_PUBLIC_SUPABASE_ANON_KEY</b> sur Vercel pour activer le QR à usage unique.</p>
              </div>
            ) : step === "qr" ? (
              <div className="text-center pt-2">
                <div className="inline-block rounded-3xl bg-white p-4 shadow-card"><img src={qr} alt="QR" className="h-64 w-64" /></div>
                <p className="font-display text-lg font-semibold text-ink mt-4">Fais scanner ce code au médecin</p>
                <p className="text-sm text-ink-mute mt-1">Lien à <b>usage unique</b>, expire dans 24 h.</p>
                <button onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-white shadow-card px-4 py-2.5 text-sm font-bold text-ink-soft active:scale-95">
                  {copied ? <><Check className="h-4 w-4 text-brand-600" /> Copié</> : <><Copy className="h-4 w-4" /> Copier le lien</>}
                </button>
              </div>
            ) : (
              <div className="space-y-5 pt-1">
                <section>
                  <p className="text-[11px] font-bold tracking-widest uppercase text-ink-mute mb-2 px-1">Pour quel médecin ?</p>
                  <select value={docId} onChange={(e) => setDocId(e.target.value)} className="w-full bg-white shadow-card rounded-2xl px-3.5 py-3 text-ink outline-none font-semibold">
                    <option value="">— Choisir —</option>
                    {doctors.map((d) => <option key={d.id} value={d.id}>{d.name || "Médecin"}{d.specialty ? ` — ${d.specialty}` : ""}</option>)}
                  </select>
                  <button onClick={() => setGuest((g) => !g)} className="mt-2 w-full card p-3.5 flex items-center gap-3 text-left">
                    <span className={`grid place-items-center h-9 w-9 rounded-xl shrink-0 ${guest ? "bg-brand-500 text-white" : "bg-cream text-brand-700"}`}><UserPlus className="h-5 w-5" /></span>
                    <div className="flex-1"><p className="font-bold text-ink text-[14px]">Autoriser un médecin « invité »</p><p className="text-[12px] text-ink-mute">Un médecin non listé pourra ouvrir, mais ne verra que les PDF.</p></div>
                    <span className={`relative h-6 w-11 rounded-full transition ${guest ? "bg-brand-500" : "bg-black/15"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${guest ? "left-6" : "left-1"}`} /></span>
                  </button>
                </section>

                <section>
                  <p className="text-[11px] font-bold tracking-widest uppercase text-ink-mute mb-2 px-1">Quelles infos divulguer ?</p>
                  <div className="card divide-y divide-black/5">
                    <Row on={infoSheet} set={setInfoSheet} label="Fiche essentielle" sub="Allergies, pathologies, traitements, groupe sanguin" />
                    <Row on={infoRx} set={setInfoRx} label="Ordonnances & certificats" sub="Titres et dates (les dates de péremption sont mises en avant)" />
                    <Row on={infoSy} set={setInfoSy} label="Symptômes récents (30 j)" sub="Ce que tu as signalé récemment" />
                  </div>
                </section>

                <section>
                  <p className="text-[11px] font-bold tracking-widest uppercase text-ink-mute mb-2 px-1">Joindre des PDF ?</p>
                  <div className="space-y-2">
                    {reports.length === 0 && docs.length === 0 && <p className="text-sm text-ink-mute px-1">Aucun rapport ni document pour l'instant.</p>}
                    {reports.map((r) => <PdfRow key={r.id} on={sel.has(`report:${r.id}`)} onClick={() => toggle(`report:${r.id}`)} label={`Rapport ${r.kind === "therapeute" ? "thérapeute" : "perso"} · ${r.period} j`} />)}
                    {docs.map((d) => <PdfRow key={d.id} on={sel.has(`doc:${d.id}`)} onClick={() => toggle(`doc:${d.id}`)} label={`${d.title} (${d.type})`} />)}
                  </div>
                </section>

                {err && <p className="text-sm text-red-500 px-1">{err}</p>}
                <button onClick={generate} disabled={loading || (!docId && !guest)} className="w-full rounded-3xl py-4 bg-brand-500 text-white font-display text-[17px] font-semibold shadow-glow flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[.99]">
                  {loading ? <><Loader2 className="h-5 w-5 animate-spin" /> Création…</> : <><QrCode className="h-5 w-5" /> Générer le QR</>}
                </button>
                <p className="text-[11px] text-ink-mute text-center">Lien à usage unique, expire dans 24 h. Note : le web ne peut pas empêcher les captures d'écran.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}

function Row({ on, set, label, sub }: { on: boolean; set: (b: boolean) => void; label: string; sub: string }) {
  return (
    <button onClick={() => set(!on)} className="w-full flex items-center gap-3 p-4 text-left">
      <span className={`grid place-items-center h-8 w-8 rounded-lg border-2 shrink-0 ${on ? "bg-brand-500 border-brand-500 text-white" : "border-black/15 text-transparent"}`}><Check className="h-4 w-4" strokeWidth={3} /></span>
      <div className="flex-1"><p className="font-bold text-ink text-[14px]">{label}</p><p className="text-[12px] text-ink-mute">{sub}</p></div>
    </button>
  );
}
function PdfRow({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="w-full card p-3.5 flex items-center gap-3 text-left">
      <span className={`grid place-items-center h-8 w-8 rounded-lg border-2 shrink-0 ${on ? "bg-brand-500 border-brand-500 text-white" : "border-black/15 text-transparent"}`}><Check className="h-4 w-4" strokeWidth={3} /></span>
      <span className="flex-1 font-semibold text-ink text-[14px] truncate">{label}</span>
    </button>
  );
}
