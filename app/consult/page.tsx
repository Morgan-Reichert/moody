"use client";

import { useEffect, useRef, useState } from "react";
import { consumeShare, ConsumeResult } from "@/lib/share";
import {
  ShieldCheck, UserRound, FileText, AlertTriangle, Lock, Stethoscope, HeartPulse, Activity,
} from "lucide-react";

type Phase = "loading" | "picker" | "view" | "error";

function expiryBadge(iso?: string) {
  if (!iso) return null;
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 864e5);
  const urgent = days <= 30;
  return <span className={`ml-2 inline-flex items-center gap-1 text-[11px] font-bold rounded-full px-2 py-0.5 ${urgent ? "bg-[#fbe1da] text-[#c0402a]" : "bg-brand-50 text-brand-700"}`}>{urgent && <AlertTriangle className="h-3 w-3" />}{days < 0 ? `périmé (${iso})` : `à renouveler avant le ${iso}`}</span>;
}

export default function Consult() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [res, setRes] = useState<ConsumeResult | null>(null);
  const [role, setRole] = useState<"doctor" | "guest" | null>(null);
  const [err, setErr] = useState("");
  const [hide, setHide] = useState(false);
  const once = useRef(false);

  useEffect(() => {
    if (once.current) return; once.current = true;
    const token = new URLSearchParams(window.location.search).get("t");
    if (!token) { setErr("Lien invalide."); setPhase("error"); return; }
    consumeShare(token)
      .then((r) => { setRes(r); setPhase("picker"); })
      .catch((e) => {
        const m = String(e?.message || "");
        setErr(m.includes("already_used") ? "Ce lien a déjà été consulté (usage unique)."
          : m.includes("expired") ? "Ce lien a expiré."
          : m.includes("not_configured") ? "Service non configuré."
          : "Lien introuvable ou déjà utilisé.");
        setPhase("error");
      });
  }, []);

  // screenshot deterrents (not foolproof on the web)
  useEffect(() => {
    const onVis = () => setHide(document.visibilityState === "hidden");
    const noMenu = (e: Event) => e.preventDefault();
    document.addEventListener("visibilitychange", onVis);
    document.addEventListener("contextmenu", noMenu);
    return () => { document.removeEventListener("visibilitychange", onVis); document.removeEventListener("contextmenu", noMenu); };
  }, []);

  return (
    <div className="min-h-[100dvh] bg-cream text-ink select-none" style={{ WebkitUserSelect: "none" }}>
      <div className={`${hide ? "blur-xl" : ""} transition`}>
        <header className="px-5 pt-safe pb-3 bg-gradient-to-b from-brand-500 to-brand-600 text-white">
          <div className="max-w-md mx-auto pt-4">
            <div className="flex items-center gap-2"><HeartPulse className="h-6 w-6" /><span className="font-display text-xl font-semibold">Moody · consultation</span></div>
            <p className="text-white/80 text-[13px] mt-1">Document partagé par le patient · confidentiel</p>
          </div>
        </header>

        <div className="max-w-md mx-auto px-5 py-6">
          {phase === "loading" && <p className="text-center text-ink-mute py-16">Ouverture du lien…</p>}

          {phase === "error" && (
            <div className="text-center py-16">
              <Lock className="h-10 w-10 mx-auto text-ink-mute mb-3" />
              <p className="font-display text-lg font-semibold text-ink">{err}</p>
              <p className="text-sm text-ink-mute mt-1">Demande au patient de régénérer un lien si besoin.</p>
            </div>
          )}

          {phase === "picker" && res && (
            <div className="space-y-3">
              <p className="text-center text-ink-soft mb-2">Qui consulte ce document ?</p>
              {res.doctor_name && (
                <button onClick={() => { setRole("doctor"); setPhase("view"); }} className="w-full rounded-3xl p-5 bg-white shadow-card text-left active:scale-[.99] flex items-center gap-3">
                  <span className="grid place-items-center h-12 w-12 rounded-2xl bg-brand-500 text-white"><Stethoscope className="h-6 w-6" /></span>
                  <div><p className="font-bold text-ink">Je suis {res.doctor_name}</p><p className="text-[13px] text-ink-mute">Accès complet aux infos partagées</p></div>
                </button>
              )}
              {res.guest_allowed && (
                <button onClick={() => { setRole("guest"); setPhase("view"); }} className="w-full rounded-3xl p-5 bg-white shadow-card text-left active:scale-[.99] flex items-center gap-3">
                  <span className="grid place-items-center h-12 w-12 rounded-2xl bg-lilac text-brand-700"><UserRound className="h-6 w-6" /></span>
                  <div><p className="font-bold text-ink">Accès invité</p><p className="text-[13px] text-ink-mute">Uniquement les documents PDF joints</p></div>
                </button>
              )}
              {!res.doctor_name && !res.guest_allowed && <p className="text-center text-ink-mute">Aucun accès disponible.</p>}
            </div>
          )}

          {phase === "view" && res && (
            <div className="space-y-4">
              {res.payload.patientName && <p className="text-[13px] text-ink-mute">Patient : <b className="text-ink">{res.payload.patientName}</b></p>}

              {role === "doctor" && res.payload.sheet && (
                <Card icon={<Activity className="h-[18px] w-[18px]" />} title="Fiche essentielle">
                  <Line label="Pathologies" v={res.payload.sheet.conditions} />
                  <Line label="Allergies" v={res.payload.sheet.allergies} urgent />
                  <Line label="Traitements en cours" v={res.payload.sheet.treatments} />
                  <div className="flex gap-4">
                    <Line label="Groupe sanguin" v={res.payload.sheet.bloodType} />
                    <Line label="Taille" v={res.payload.sheet.height && `${res.payload.sheet.height} cm`} />
                    <Line label="Poids" v={res.payload.sheet.weight && `${res.payload.sheet.weight} kg`} />
                  </div>
                </Card>
              )}

              {role === "doctor" && res.payload.prescriptions && res.payload.prescriptions.length > 0 && (
                <Card icon={<FileText className="h-[18px] w-[18px]" />} title="Ordonnances & certificats">
                  <div className="space-y-2">
                    {res.payload.prescriptions.map((p, i) => (
                      <div key={i} className="rounded-xl bg-brand-50 p-3">
                        <p className="font-bold text-ink text-[14px]">{p.title}{expiryBadge(p.expiry)}</p>
                        <p className="text-[12px] text-ink-mute">{p.date ? `émis le ${p.date}` : ""}{p.doctor ? ` · ${p.doctor}` : ""}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {role === "doctor" && res.payload.symptoms && res.payload.symptoms.length > 0 && (
                <Card icon={<HeartPulse className="h-[18px] w-[18px]" />} title="Symptômes récents">
                  <div className="space-y-1.5">
                    {res.payload.symptoms.map((s, i) => <p key={i} className="text-[13px] text-ink-soft"><b className="text-ink">{s.date}</b> — {s.symptoms.join(", ")}{s.intensity ? ` (${["", "léger", "modéré", "fort"][s.intensity]})` : ""}</p>)}
                  </div>
                </Card>
              )}

              <Card icon={<FileText className="h-[18px] w-[18px]" />} title="Documents joints">
                {res.pdf_urls.length === 0 ? <p className="text-sm text-ink-mute">Aucun PDF joint.</p> : (
                  <div className="space-y-2">
                    {res.pdf_urls.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl bg-brand-500 text-white px-4 py-3 font-bold active:scale-[.99]"><FileText className="h-5 w-5" /> Ouvrir le PDF {i + 1}</a>)}
                  </div>
                )}
              </Card>

              <p className="text-[11px] text-ink-mute text-center pt-2 flex items-center justify-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Lien à usage unique · document confidentiel · ne pas diffuser</p>
            </div>
          )}
        </div>
      </div>
      {/* subtle watermark */}
      {phase === "view" && (
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center opacity-[0.04] -rotate-12 text-5xl font-display font-bold">Moody · confidentiel</div>
      )}
    </div>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white shadow-card p-4">
      <div className="flex items-center gap-2 text-brand-700 mb-2.5">{icon}<h2 className="font-display text-[16px] font-semibold text-ink">{title}</h2></div>
      {children}
    </section>
  );
}
function Line({ label, v, urgent }: { label: string; v?: string; urgent?: boolean }) {
  if (!v) return null;
  return <p className="text-[13px] mb-1"><span className="text-ink-mute">{label} : </span><span className={`font-semibold ${urgent ? "text-[#c0402a]" : "text-ink"}`}>{v}</span></p>;
}
