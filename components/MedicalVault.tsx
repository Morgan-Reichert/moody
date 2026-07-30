"use client";

import { useEffect, useRef, useState } from "react";
import {
  useStore, getMedicalProfile, saveMedicalProfile, getMeds,
  getDoctors, saveDoctor, deleteDoctor, Doctor,
  getAppointments, saveAppointment, deleteAppointment, Appointment, TreatmentEntry,
} from "@/lib/storage";
import { saveDoc, listDocs, getDocBlob, deleteDoc, openBlob, DocMeta, DocType } from "@/lib/vault-db";
import { SpecialtyPicker } from "@/components/SpecialtyPicker";
import { PathologyPicker } from "@/components/PathologyPicker";
import { MedAutocomplete } from "@/components/MedAutocomplete";
import { DocScanner } from "@/components/DocScanner";
import { ShareDoctorModal } from "@/components/ShareDoctorModal";
import { Portal } from "@/components/Portal";
import {
  X, Plus, Trash2, User, Stethoscope, FileText, CalendarClock, ChevronDown,
  Phone, Mail, MapPin, FolderOpen, Upload, HeartPulse, Bell, ScanText, AlertTriangle, QrCode,
  Camera, Pill, Check,
} from "lucide-react";

function expiryInfo(iso?: string): { label: string; urgent: boolean } | null {
  if (!iso) return null;
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 864e5);
  if (days < 0) return { label: `périmé depuis ${-days} j`, urgent: true };
  if (days === 0) return { label: "périme aujourd'hui", urgent: true };
  return { label: `périme dans ${days} j`, urgent: days <= 30 };
}

type Tab = "fiche" | "medecins" | "documents" | "rdv";
const BLOOD = ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const DOC_TYPES: { key: DocType; label: string }[] = [
  { key: "ordonnance", label: "Ordonnance" }, { key: "certificat", label: "Certificat" },
  { key: "analyse", label: "Analyse" }, { key: "autre", label: "Autre" },
];

export function MedicalVault({ onClose }: { onClose: () => void }) {
  useStore();
  const [tab, setTab] = useState<Tab>("fiche");
  const [showShare, setShowShare] = useState(false);
  const doctors = getDoctors();
  const appts = getAppointments();

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex flex-col justify-end" role="dialog" aria-modal="true">
        <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-cream rounded-t-4xl h-[94vh] flex flex-col animate-sheetUp">
          <div className="px-5 pt-3 pb-2 shrink-0">
            <div className="mx-auto h-1.5 w-10 rounded-full bg-black/10 mb-3" />
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-xl font-semibold text-ink flex items-center gap-2"><HeartPulse className="h-5 w-5 text-brand-600" /> Espace santé</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowShare(true)} className="grid place-items-center h-10 w-10 rounded-2xl bg-brand-500 text-white shadow-glow active:scale-95" aria-label="Partager à un médecin"><QrCode className="h-5 w-5" /></button>
                <button onClick={onClose} className="grid place-items-center h-10 w-10 rounded-2xl bg-white shadow-card text-ink-soft active:scale-95"><X className="h-5 w-5" /></button>
              </div>
            </div>
            <div className="flex gap-1.5 bg-white rounded-2xl p-1 shadow-card">
              {([["fiche", "Fiche", User], ["medecins", "Médecins", Stethoscope], ["documents", "Docs", FileText], ["rdv", "RDV", CalendarClock]] as const).map(([k, label, Icon]) => (
                <button key={k} onClick={() => setTab(k)} className={`flex-1 flex flex-col items-center gap-0.5 rounded-xl py-2 transition ${tab === k ? "bg-brand-500 text-white shadow-glow" : "text-ink-mute"}`}>
                  <Icon className="h-[18px] w-[18px]" /><span className="text-[11px] font-bold">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-none px-5 pb-8 pt-2">
            {tab === "fiche" && <FicheTab />}
            {tab === "medecins" && <MedecinsTab doctors={doctors} />}
            {tab === "documents" && <DocumentsTab doctors={doctors} />}
            {tab === "rdv" && <RdvTab doctors={doctors} appts={appts} />}
          </div>
        </div>
      </div>
      {showShare && <ShareDoctorModal onClose={() => setShowShare(false)} />}
    </Portal>
  );
}

function Field({ label, defVal, onSave, placeholder, type = "text", area }: { label: string; defVal?: string; onSave: (v: string) => void; placeholder?: string; type?: string; area?: boolean }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold tracking-widest uppercase text-ink-mute">{label}</span>
      {area ? (
        <textarea defaultValue={defVal} onBlur={(e) => onSave(e.target.value)} placeholder={placeholder} rows={2}
          className="mt-1 w-full bg-brand-50 rounded-xl px-3.5 py-2.5 text-ink outline-none resize-none" />
      ) : (
        <input type={type} defaultValue={defVal} onBlur={(e) => onSave(e.target.value)} placeholder={placeholder}
          className="mt-1 w-full bg-brand-50 rounded-xl px-3.5 py-2.5 text-ink outline-none" />
      )}
    </label>
  );
}

async function compressPhoto(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const max = 320; const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  c.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  return c.toDataURL("image/jpeg", 0.72);
}

function PhotoField() {
  const p = getMedicalProfile();
  const ref = useRef<HTMLInputElement>(null);
  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { saveMedicalProfile({ photo: await compressPhoto(f) }); } catch { /* */ }
    e.target.value = "";
  };
  return (
    <div className="flex items-center gap-4">
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={onPick} />
      <button onClick={() => ref.current?.click()} className="relative h-20 w-20 rounded-full bg-brand-50 grid place-items-center overflow-hidden shrink-0 active:scale-95">
        {p.photo ? <img src={p.photo} alt="" className="h-full w-full object-cover" /> : <Camera className="h-7 w-7 text-brand-600" />}
      </button>
      <div>
        <p className="font-bold text-ink">Photo de profil</p>
        <p className="text-[12.5px] text-ink-mute">Apparaîtra sur la fiche partagée au médecin.</p>
        {p.photo && <button onClick={() => saveMedicalProfile({ photo: undefined })} className="text-[12.5px] font-bold text-red-400 mt-1">Retirer</button>}
      </div>
    </div>
  );
}

function TreatmentsEditor() {
  const p = getMedicalProfile();
  const list = p.treatmentList ?? [];
  const appMeds = getMeds();
  const save = (l: TreatmentEntry[]) => saveMedicalProfile({ treatmentList: l });
  const row = (name: string, meta: string, right: React.ReactNode, key: string) => (
    <div key={key} className="rounded-2xl bg-brand-50/60 p-3 flex items-center gap-3">
      <Pill className="h-4 w-4 text-[#c8622f] shrink-0" />
      <div className="flex-1 min-w-0"><p className="font-bold text-ink text-[14px] truncate">{name}</p><p className="text-[12px] text-ink-mute">{meta || "—"}</p></div>
      {right}
    </div>
  );
  return (
    <div className="space-y-2.5">
      <p className="text-[12.5px] text-ink-mute">Tes médicaments de l'app apparaissent ici automatiquement. Tu peux en ajouter d'autres.</p>
      {appMeds.map((m) => row(
        m.name,
        [m.dose, m.slots.length ? `${m.slots.length}×/j` : "", m.slots.map((s) => s.time).join(", ")].filter(Boolean).join(" · "),
        <span className="text-[10px] font-bold text-brand-700 bg-white rounded-full px-2 py-0.5">app</span>,
        m.id,
      ))}
      {list.map((t, i) => row(
        t.name,
        [t.dose, t.perDay ? `${t.perDay}×/j` : "", t.timing].filter(Boolean).join(" · "),
        <button onClick={() => save(list.filter((_, j) => j !== i))} className="grid place-items-center h-8 w-8 rounded-lg text-red-400"><Trash2 className="h-4 w-4" /></button>,
        "m" + i,
      ))}
      <ManualTreatmentForm onAdd={(t) => save([...list, t])} />
    </div>
  );
}
function ManualTreatmentForm({ onAdd }: { onAdd: (t: TreatmentEntry) => void }) {
  const [name, setName] = useState(""); const [dose, setDose] = useState(""); const [perDay, setPerDay] = useState(""); const [timing, setTiming] = useState("");
  const add = () => { if (!name.trim()) return; onAdd({ name: name.trim(), dose: dose.trim() || undefined, perDay: perDay.trim() || undefined, timing: timing.trim() || undefined }); setName(""); setDose(""); setPerDay(""); setTiming(""); };
  return (
    <div className="card p-3 space-y-2">
      <MedAutocomplete value={name} onChange={setName} onPick={(nm) => setName(nm)} placeholder="Chercher un médicament…" />
      <div className="grid grid-cols-3 gap-2">
        <input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="Dose" className="bg-brand-50 rounded-xl px-3 py-2.5 text-ink outline-none text-[14px]" />
        <input value={perDay} onChange={(e) => setPerDay(e.target.value)} placeholder="×/jour" inputMode="numeric" className="bg-brand-50 rounded-xl px-3 py-2.5 text-ink outline-none text-[14px]" />
        <input value={timing} onChange={(e) => setTiming(e.target.value)} placeholder="Moment" className="bg-brand-50 rounded-xl px-3 py-2.5 text-ink outline-none text-[14px]" />
      </div>
      <button onClick={add} className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 bg-brand-500 text-white font-bold text-sm active:scale-[.98]"><Plus className="h-4 w-4" /> Ajouter ce traitement</button>
    </div>
  );
}

function FicheTab() {
  const p = getMedicalProfile();
  const s = (k: keyof typeof p) => (v: string) => saveMedicalProfile({ [k]: v.trim() || undefined });
  return (
    <div className="space-y-5">
      <p className="text-[13px] text-ink-soft">Ces informations restent sur ton appareil. Utile en cas d'urgence ou de consultation.</p>
      <Section title="Identité"><PhotoField />
        <Field label="Nom complet" defVal={p.fullName} onSave={s("fullName")} placeholder="Prénom Nom" />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Naissance" defVal={p.birthDate} onSave={s("birthDate")} type="date" />
          <label className="block"><span className="text-[11px] font-bold tracking-widest uppercase text-ink-mute">Sexe</span>
            <select defaultValue={p.sex ?? ""} onChange={(e) => saveMedicalProfile({ sex: e.target.value || undefined })} className="mt-1 w-full bg-brand-50 rounded-xl px-2 py-2.5 text-ink outline-none">
              <option value="">—</option><option>Femme</option><option>Homme</option><option>Autre</option>
            </select></label>
        </div>
      </Section>
      <Section title="Physique">
        <div className="grid grid-cols-3 gap-2">
          <Field label="Taille (cm)" defVal={p.height} onSave={s("height")} type="number" />
          <Field label="Poids (kg)" defVal={p.weight} onSave={s("weight")} type="number" />
          <label className="block">
            <span className="text-[11px] font-bold tracking-widest uppercase text-ink-mute">Groupe</span>
            <select defaultValue={p.bloodType ?? ""} onChange={(e) => saveMedicalProfile({ bloodType: e.target.value || undefined })}
              className="mt-1 w-full bg-brand-50 rounded-xl px-2 py-2.5 text-ink outline-none">
              {BLOOD.map((b) => <option key={b} value={b}>{b || "—"}</option>)}
            </select>
          </label>
        </div>
      </Section>
      <Section title="Pathologies">
        <PathologyPicker values={p.conditionsList ?? []} onChange={(v) => saveMedicalProfile({ conditionsList: v.length ? v : undefined })} />
        <Field label="Allergies" defVal={p.allergies} onSave={s("allergies")} area placeholder="Ex : pénicilline, arachide…" />
      </Section>
      <Section title="Traitements en cours"><TreatmentsEditor /></Section>
      <Section title="Antécédents (passé médical)">
        <Field label="Antécédents médicaux" defVal={p.history} onSave={s("history")} area />
        <Field label="Opérations / chirurgies" defVal={p.surgeries} onSave={s("surgeries")} area />
      </Section>
      <Section title="Contact d'urgence">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Nom" defVal={p.emergencyName} onSave={s("emergencyName")} />
          <Field label="Téléphone" defVal={p.emergencyPhone} onSave={s("emergencyPhone")} type="tel" />
        </div>
      </Section>
      <Section title="Mineur ?">
        <button onClick={() => saveMedicalProfile({ isMinor: !p.isMinor })} className="w-full flex items-center gap-3 text-left">
          <span className={`grid place-items-center h-8 w-8 rounded-lg border-2 shrink-0 ${p.isMinor ? "bg-brand-500 border-brand-500 text-white" : "border-black/15 text-transparent"}`}><Check className="h-4 w-4" strokeWidth={3} /></span>
          <span className="flex-1"><span className="font-bold text-ink text-[14px] block">Je suis mineur·e</span><span className="text-[12px] text-ink-mute">Ajoute le contact de ton référent légal</span></span>
        </button>
        {p.isMinor && (
          <div className="grid grid-cols-1 gap-2 mt-3">
            <Field label="Référent légal — nom" defVal={p.guardianName} onSave={s("guardianName")} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Téléphone" defVal={p.guardianPhone} onSave={s("guardianPhone")} type="tel" />
              <Field label="Lien" defVal={p.guardianRelation} onSave={s("guardianRelation")} placeholder="Parent, tuteur…" />
            </div>
          </div>
        )}
      </Section>
      <Section title="Notes libres"><Field label="Notes" defVal={p.notes} onSave={s("notes")} area /></Section>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="card p-4 space-y-3"><p className="font-display text-[15px] font-semibold text-ink">{title}</p>{children}</div>;
}

function MedecinsTab({ doctors }: { doctors: Doctor[] }) {
  return (
    <div className="space-y-3">
      {doctors.length === 0 && <p className="text-sm text-ink-mute text-center py-4">Aucun médecin enregistré.</p>}
      {doctors.map((d) => <DoctorCard key={d.id} doc={d} />)}
      <button onClick={() => saveDoctor({ name: "", specialty: "" })} className="w-full flex items-center justify-center gap-1.5 rounded-2xl py-3 bg-white shadow-card text-brand-700 font-bold text-sm active:scale-[.98]"><Plus className="h-4 w-4" /> Ajouter un médecin</button>
    </div>
  );
}
function DoctorCard({ doc }: { doc: Doctor }) {
  const [open, setOpen] = useState(doc.name === "");
  const [name, setName] = useState(doc.name);
  const commit = (extra?: Partial<Doctor>) => saveDoctor({ ...doc, name: name.trim() || "Médecin", ...extra });
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <span className="grid place-items-center h-10 w-10 rounded-2xl bg-lilac text-brand-700 shrink-0"><Stethoscope className="h-5 w-5" /></span>
        <div className="flex-1 min-w-0"><p className="font-bold text-ink truncate">{doc.name || "Nouveau médecin"}</p><p className="text-[12.5px] text-ink-mute truncate">{doc.specialty || "Spécialité ?"}</p></div>
        <button onClick={() => setOpen((o) => !o)} className="grid place-items-center h-9 w-9 rounded-xl bg-brand-50 text-brand-700 active:scale-95"><ChevronDown className={`h-5 w-5 transition ${open ? "rotate-180" : ""}`} /></button>
      </div>
      {open && (
        <div className="mt-4 space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => commit()} placeholder="Nom (Dr …)" className="w-full bg-brand-50 rounded-xl px-3.5 py-2.5 font-semibold text-ink outline-none" />
          <SpecialtyPicker value={doc.specialty} onChange={(v) => saveDoctor({ ...doc, specialty: v })} />
          <div className="grid grid-cols-2 gap-2">
            <input defaultValue={doc.phone} onBlur={(e) => saveDoctor({ ...doc, phone: e.target.value.trim() || undefined })} placeholder="Téléphone" type="tel" className="bg-brand-50 rounded-xl px-3 py-2.5 text-ink outline-none" />
            <input defaultValue={doc.email} onBlur={(e) => saveDoctor({ ...doc, email: e.target.value.trim() || undefined })} placeholder="Email" type="email" className="bg-brand-50 rounded-xl px-3 py-2.5 text-ink outline-none" />
          </div>
          <input defaultValue={doc.address} onBlur={(e) => saveDoctor({ ...doc, address: e.target.value.trim() || undefined })} placeholder="Adresse du cabinet" className="w-full bg-brand-50 rounded-xl px-3.5 py-2.5 text-ink outline-none" />
          <textarea defaultValue={doc.notes} onBlur={(e) => saveDoctor({ ...doc, notes: e.target.value.trim() || undefined })} placeholder="Notes" rows={2} className="w-full bg-brand-50 rounded-xl px-3.5 py-2.5 text-ink outline-none resize-none" />
          <div className="flex gap-2">
            {doc.phone && <a href={`tel:${doc.phone}`} className="flex-1 grid place-items-center rounded-xl py-2.5 bg-brand-50 text-brand-700"><Phone className="h-5 w-5" /></a>}
            {doc.email && <a href={`mailto:${doc.email}`} className="flex-1 grid place-items-center rounded-xl py-2.5 bg-brand-50 text-brand-700"><Mail className="h-5 w-5" /></a>}
            {doc.address && <a href={`https://maps.google.com/?q=${encodeURIComponent(doc.address)}`} target="_blank" rel="noreferrer" className="flex-1 grid place-items-center rounded-xl py-2.5 bg-brand-50 text-brand-700"><MapPin className="h-5 w-5" /></a>}
            <button onClick={() => deleteDoctor(doc.id)} className="grid place-items-center h-11 w-11 rounded-xl bg-white text-red-400 shadow-card active:scale-95"><Trash2 className="h-5 w-5" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentsTab({ doctors }: { doctors: Doctor[] }) {
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [scan, setScan] = useState(false);
  const [dtype, setDtype] = useState<DocType>("ordonnance");
  const [dtitle, setDtitle] = useState("");
  const [ddoc, setDdoc] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = () => listDocs().then(setDocs).catch(() => {});
  useEffect(() => { refresh(); }, []);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    await saveDoc({ type: dtype, title: dtitle.trim() || f.name, date: new Date().toISOString().slice(0, 10), doctorId: ddoc || undefined, mime: f.type, filename: f.name, blob: f });
    setDtitle(""); e.target.value = ""; refresh();
  };
  const open = async (id: string) => { const r = await getDocBlob(id); if (r) openBlob(r.blob); };
  const del = async (id: string) => { await deleteDoc(id); refresh(); };

  return (
    <div className="space-y-4">
      <button onClick={() => setScan(true)} className="w-full rounded-3xl py-4 bg-brand-500 text-white font-display text-[16px] font-semibold shadow-glow flex items-center justify-center gap-2 active:scale-[.99]">
        <ScanText className="h-5 w-5" /> Scanner un document (auto)
      </button>
      {scan && <DocScanner onClose={() => setScan(false)} onSaved={refresh} />}

      <div className="card p-4 space-y-3">
        <p className="font-display text-[15px] font-semibold text-ink">Ajouter manuellement</p>
        <div className="grid grid-cols-4 gap-1.5">
          {DOC_TYPES.map((t) => <button key={t.key} onClick={() => setDtype(t.key)} className={`rounded-xl py-2 text-[12px] font-bold transition ${dtype === t.key ? "bg-brand-500 text-white" : "bg-brand-50 text-ink-soft"}`}>{t.label}</button>)}
        </div>
        <input value={dtitle} onChange={(e) => setDtitle(e.target.value)} placeholder="Titre (optionnel)" className="w-full bg-brand-50 rounded-xl px-3.5 py-2.5 text-ink outline-none" />
        <select value={ddoc} onChange={(e) => setDdoc(e.target.value)} className="w-full bg-brand-50 rounded-xl px-3 py-2.5 text-ink outline-none">
          <option value="">Lier à un médecin (optionnel)</option>
          {doctors.map((d) => <option key={d.id} value={d.id}>{d.name || "Médecin"}{d.specialty ? ` — ${d.specialty}` : ""}</option>)}
        </select>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onFile} />
        <button onClick={() => fileRef.current?.click()} className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 bg-brand-500 text-white font-bold shadow-glow active:scale-[.98]"><Upload className="h-5 w-5" /> Importer / photographier</button>
      </div>

      <div className="space-y-2.5">
        {docs.length === 0 ? <p className="text-sm text-ink-mute text-center py-4">Aucun document.</p> : docs.map((d) => {
          const doc = doctors.find((x) => x.id === d.doctorId);
          return (
            <div key={d.id} className="card p-3.5 flex items-center gap-3">
              <span className="grid place-items-center h-11 w-11 rounded-2xl bg-peach text-[#c8622f] shrink-0"><FileText className="h-5 w-5" /></span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-ink text-[14.5px] truncate">{d.title}</p>
                <p className="text-[12px] text-ink-mute truncate capitalize">{d.type}{d.date ? ` · ${d.date}` : ""}{doc ? ` · ${doc.name}` : ""}</p>
                {(() => { const ex = expiryInfo(d.expiryDate); return ex ? (
                  <span className={`inline-flex items-center gap-1 mt-1 text-[11px] font-bold rounded-full px-2 py-0.5 ${ex.urgent ? "bg-[#fbe1da] text-[#c0402a]" : "bg-brand-50 text-brand-700"}`}>
                    {ex.urgent && <AlertTriangle className="h-3 w-3" />}{ex.label}{d.notifyExpiry && <Bell className="h-3 w-3" />}
                  </span>
                ) : null; })()}
              </div>
              <button onClick={() => open(d.id)} className="grid place-items-center h-10 w-10 rounded-xl bg-brand-500 text-white active:scale-95"><FolderOpen className="h-[18px] w-[18px]" /></button>
              <button onClick={() => del(d.id)} className="grid place-items-center h-10 w-10 rounded-xl bg-white text-red-400 shadow-card active:scale-95"><Trash2 className="h-[18px] w-[18px]" /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RdvTab({ doctors, appts }: { doctors: Doctor[]; appts: Appointment[] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5 rounded-2xl bg-brand-50 px-4 py-3">
        <Bell className="h-5 w-5 text-brand-600 shrink-0 mt-0.5" />
        <p className="text-[12.5px] text-brand-700 font-semibold">Tu seras notifié 24 h, 12 h, 1 h et 15 min avant chaque rendez-vous (quand l'app est ouverte/active).</p>
      </div>
      {appts.map((a) => <AppointmentCard key={a.id} appt={a} doctors={doctors} />)}
      <button onClick={() => saveAppointment({ title: "Rendez-vous", datetime: new Date(Date.now() + 864e5).toISOString().slice(0, 16) })} className="w-full flex items-center justify-center gap-1.5 rounded-2xl py-3 bg-white shadow-card text-brand-700 font-bold text-sm active:scale-[.98]"><Plus className="h-4 w-4" /> Ajouter un rendez-vous</button>
    </div>
  );
}
function AppointmentCard({ appt, doctors }: { appt: Appointment; doctors: Doctor[] }) {
  const dt = new Date(appt.datetime);
  const localValue = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <span className="grid place-items-center h-10 w-10 rounded-2xl bg-brand-500 text-white shrink-0"><CalendarClock className="h-5 w-5" /></span>
        <input defaultValue={appt.title} onBlur={(e) => saveAppointment({ ...appt, title: e.target.value.trim() || "Rendez-vous" })} className="flex-1 bg-transparent font-bold text-ink outline-none min-w-0" />
        <button onClick={() => deleteAppointment(appt.id)} className="grid place-items-center h-9 w-9 rounded-xl bg-white text-red-400 shadow-card active:scale-95"><Trash2 className="h-[18px] w-[18px]" /></button>
      </div>
      <input type="datetime-local" defaultValue={localValue}
        onChange={(e) => { if (e.target.value) saveAppointment({ ...appt, datetime: new Date(e.target.value).toISOString() }); }}
        className="w-full bg-brand-50 rounded-xl px-3.5 py-2.5 font-display font-semibold text-ink outline-none" />
      <select value={appt.doctorId ?? ""} onChange={(e) => saveAppointment({ ...appt, doctorId: e.target.value || undefined })} className="w-full bg-brand-50 rounded-xl px-3 py-2.5 text-ink outline-none">
        <option value="">Médecin (optionnel)</option>
        {doctors.map((d) => <option key={d.id} value={d.id}>{d.name || "Médecin"}{d.specialty ? ` — ${d.specialty}` : ""}</option>)}
      </select>
      <input defaultValue={appt.address} onBlur={(e) => saveAppointment({ ...appt, address: e.target.value.trim() || undefined })} placeholder="Adresse du rendez-vous" className="w-full bg-brand-50 rounded-xl px-3.5 py-2.5 text-ink outline-none" />
      <textarea defaultValue={appt.notes} onBlur={(e) => saveAppointment({ ...appt, notes: e.target.value.trim() || undefined })} placeholder="Notes (motif, à apporter…)" rows={2} className="w-full bg-brand-50 rounded-xl px-3.5 py-2.5 text-ink outline-none resize-none" />
    </div>
  );
}
