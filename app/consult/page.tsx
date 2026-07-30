"use client";

import { useEffect, useRef, useState } from "react";
import { consumeShare, ConsumeResult } from "@/lib/share";
import {
  ShieldCheck, UserRound, FileText, AlertTriangle, Lock, Stethoscope, HeartPulse, Activity, Pill, Check, Phone,
} from "lucide-react";

type Phase = "consent" | "loading" | "picker" | "view" | "error";

function expiryBadge(iso?: string) {
  if (!iso) return null;
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 864e5);
  const urgent = days <= 30;
  return <span className={`ml-2 inline-flex items-center gap-1 text-[11px] font-bold rounded-full px-2 py-0.5 ${urgent ? "bg-[#fbe1da] text-[#c0402a]" : "bg-brand-50 text-brand-700"}`}>{urgent && <AlertTriangle className="h-3 w-3" />}{days < 0 ? `périmé (${iso})` : `à renouveler avant le ${iso}`}</span>;
}
const orNull = (v?: string | number | null) => (v == null || v === "" ? <span className="text-ink-mute italic">Non renseigné</span> : <span className="font-semibold text-ink">{v}</span>);

export default function Consult() {
  const [phase, setPhase] = useState<Phase>("consent");
  const [res, setRes] = useState<ConsumeResult | null>(null);
  const [role, setRole] = useState<"doctor" | "guest" | null>(null);
  const [err, setErr] = useState("");
  const [agree, setAgree] = useState(false);
  const [hide, setHide] = useState(false);
  const once = useRef(false);

  const open = () => {
    if (once.current) return; once.current = true;
    setPhase("loading");
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
  };

  useEffect(() => {
    const onVis = () => setHide(document.visibilityState === "hidden");
    const noMenu = (e: Event) => e.preventDefault();
    document.addEventListener("visibilitychange", onVis);
    document.addEventListener("contextmenu", noMenu);
    return () => { document.removeEventListener("visibilitychange", onVis); document.removeEventListener("contextmenu", noMenu); };
  }, []);

  const p = res?.payload;

  return (
    <div className="min-h-[100dvh] bg-cream text-ink select-none" style={{ WebkitUserSelect: "none" }}>
      <div className={`${hide ? "blur-2xl" : ""} transition`}>
        <header className="px-5 pt-safe pb-4 bg-gradient-to-b from-brand-500 to-brand-600 text-white">
          <div className="max-w-md mx-auto pt-4 flex items-center justify-between">
            <img src="/brand/moody-wordmark-white-tight.png" alt="Moody" className="h-8 w-auto" />
            <span className="text-[12px] font-semibold bg-white/15 rounded-full px-3 py-1">Consultation</span>
          </div>
        </header>

        <div className="max-w-md mx-auto px-5 py-6">
          {phase === "consent" && (
            <div className="space-y-5">
              <div className="text-center">
                <ShieldCheck className="h-11 w-11 mx-auto text-brand-500 mb-2" />
                <h1 className="font-display text-xl font-semibold text-ink">Document médical confidentiel</h1>
                <p className="text-sm text-ink-soft mt-1">Partagé par un patient via Moody. Lien à usage unique.</p>
              </div>
              <button onClick={() => setAgree((a) => !a)} className="w-full flex items-start gap-3 rounded-3xl bg-white shadow-card p-4 text-left">
                <span className={`grid place-items-center h-7 w-7 rounded-lg border-2 shrink-0 mt-0.5 ${agree ? "bg-brand-500 border-brand-500 text-white" : "border-black/15 text-transparent"}`}><Check className="h-4 w-4" strokeWidth={3} /></span>
                <span className="text-[13.5px] text-ink-soft leading-snug">Je certifie être <b className="text-ink">la personne destinataire</b> de ce lien, avoir conscience de la <b className="text-ink">valeur médicale et confidentielle</b> des informations présentées, et être <b className="text-ink">seul·e responsable de l'usage</b> que j'en fais.</span>
              </button>
              <button onClick={open} disabled={!agree} className="w-full rounded-3xl py-4 bg-brand-500 text-white font-display text-[17px] font-semibold shadow-glow disabled:opacity-40 active:scale-[.99]">Ouvrir le document</button>
              <p className="text-[11px] text-ink-mute text-center">En ouvrant, le lien sera consommé et ne pourra plus être réutilisé.</p>
            </div>
          )}

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

          {phase === "view" && p && (
            <div className="space-y-4">
              {/* Patient */}
              <section className="rounded-3xl bg-white shadow-card p-4 flex items-center gap-4">
                {p.photo ? <img src={p.photo} alt="" className="h-16 w-16 rounded-2xl object-cover" /> : <span className="grid place-items-center h-16 w-16 rounded-2xl bg-brand-50 text-brand-600"><UserRound className="h-8 w-8" /></span>}
                <div>
                  <p className="font-display text-lg font-semibold text-ink">{p.patientName || "Patient"}</p>
                  <p className="text-[13px] text-ink-soft">{orNull(p.sex)} · {p.age != null ? `${p.age} ans` : <span className="italic text-ink-mute">âge non renseigné</span>}</p>
                </div>
              </section>

              {p.guardian && (p.guardian.name || p.guardian.phone) && (
                <Card icon={<ShieldCheck className="h-[18px] w-[18px]" />} title="Référent légal (patient mineur)">
                  <p className="text-[13.5px] text-ink-soft">{orNull(p.guardian.name)}{p.guardian.relation ? ` · ${p.guardian.relation}` : ""}</p>
                  {p.guardian.phone && <a href={`tel:${p.guardian.phone}`} className="mt-1 inline-flex items-center gap-1.5 text-brand-700 font-bold text-[13.5px]"><Phone className="h-4 w-4" /> {p.guardian.phone}</a>}
                </Card>
              )}

              {role === "doctor" && (
                <>
                  <Card icon={<Activity className="h-[18px] w-[18px]" />} title="Fiche essentielle">
                    <Line label="Pathologies" v={p.sheet?.conditions} />
                    <Line label="Allergies" v={p.sheet?.allergies} urgent />
                    <div className="flex gap-4 flex-wrap">
                      <Line label="Groupe sanguin" v={p.sheet?.bloodType} />
                      <Line label="Taille" v={p.sheet?.height && `${p.sheet.height} cm`} />
                      <Line label="Poids" v={p.sheet?.weight && `${p.sheet.weight} kg`} />
                    </div>
                  </Card>

                  <Card icon={<Pill className="h-[18px] w-[18px]" />} title="Traitements en cours">
                    {p.treatments && p.treatments.length > 0 ? (
                      <div className="space-y-1.5">
                        {p.treatments.map((t, i) => (
                          <div key={i} className="text-[13.5px]"><b className="text-ink">{t.name}</b><span className="text-ink-soft">{[t.dose, t.perDay && `${t.perDay}×/j`, t.timing].filter(Boolean).length ? " — " + [t.dose, t.perDay && `${t.perDay}×/j`, t.timing].filter(Boolean).join(" · ") : ""}</span></div>
                        ))}
                      </div>
                    ) : <p className="text-[13.5px] text-ink-mute italic">Non renseigné</p>}
                  </Card>

                  {p.prescriptions && p.prescriptions.length > 0 && (
                    <Card icon={<FileText className="h-[18px] w-[18px]" />} title="Ordonnances & certificats">
                      <div className="space-y-2">
                        {p.prescriptions.map((pr, i) => (
                          <div key={i} className="rounded-xl bg-brand-50 p-3">
                            <p className="font-bold text-ink text-[14px]">{pr.title}{expiryBadge(pr.expiry)}</p>
                            <p className="text-[12px] text-ink-mute">{pr.date ? `émis le ${pr.date}` : ""}{pr.doctor ? ` · ${pr.doctor}` : ""}</p>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  {p.symptoms && p.symptoms.length > 0 && (
                    <Card icon={<HeartPulse className="h-[18px] w-[18px]" />} title="Symptômes récents">
                      <div className="space-y-1.5">{p.symptoms.map((sy, i) => <p key={i} className="text-[13px] text-ink-soft"><b className="text-ink">{sy.date}</b> — {sy.symptoms.join(", ")}{sy.intensity ? ` (${["", "léger", "modéré", "fort"][sy.intensity]})` : ""}</p>)}</div>
                    </Card>
                  )}
                </>
              )}

              <Card icon={<FileText className="h-[18px] w-[18px]" />} title="Documents joints">
                {res!.pdf_urls.length === 0 ? <p className="text-sm text-ink-mute">Aucun PDF joint.</p> : (
                  <div className="space-y-2">{res!.pdf_urls.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl bg-brand-500 text-white px-4 py-3 font-bold active:scale-[.99]"><FileText className="h-5 w-5" /> Ouvrir le PDF {i + 1}</a>)}</div>
                )}
              </Card>

              <p className="text-[11px] text-ink-mute text-center pt-2 flex items-center justify-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Lien à usage unique · document confidentiel · ne pas diffuser</p>
            </div>
          )}
        </div>
      </div>
      {phase === "view" && <div className="pointer-events-none fixed inset-0 flex items-center justify-center opacity-[0.04] -rotate-12 text-5xl font-display font-bold">Moody · confidentiel</div>}
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
  return <p className="text-[13px] mb-1"><span className="text-ink-mute">{label} : </span>{v ? <span className={`font-semibold ${urgent ? "text-[#c0402a]" : "text-ink"}`}>{v}</span> : <span className="italic text-ink-mute">Non renseigné</span>}</p>;
}
