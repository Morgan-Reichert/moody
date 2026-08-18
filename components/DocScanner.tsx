"use client";

import { useRef, useState } from "react";
import { getDoctors, saveDoctor, Doctor } from "@/lib/storage";
import { saveDoc, DocType } from "@/lib/vault-db";
import { ocrImage, parseDocument } from "@/lib/ocr";
import { Portal } from "@/components/Portal";
import { X, Camera, Loader2, Check, Bell, Plus, Stethoscope, ScanText } from "lucide-react";

const DOC_TYPES: { key: DocType; label: string }[] = [
  { key: "ordonnance", label: "Ordonnance" }, { key: "certificat", label: "Certificat" },
  { key: "analyse", label: "Analyse" }, { key: "autre", label: "Autre" },
];

type Step = "capture" | "processing" | "review";

export function DocScanner({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("capture");
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [type, setType] = useState<DocType>("autre");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [expiry, setExpiry] = useState("");
  const [prescriber, setPrescriber] = useState("");
  const [notifyExpiry, setNotifyExpiry] = useState(true);
  const [doctorId, setDoctorId] = useState("");
  const [createDoctor, setCreateDoctor] = useState(false);
  const [matched, setMatched] = useState<Doctor | null>(null);

  const run = async (f: File) => {
    setFile(f); setPreview(URL.createObjectURL(f)); setStep("processing"); setProgress(0);
    try {
      const text = await ocrImage(f, setProgress);
      const r = parseDocument(text);
      setType(r.type);
      setTitle(r.type === "ordonnance" ? "Ordonnance" : r.type === "certificat" ? "Certificat" : r.type === "analyse" ? "Analyse" : "Document");
      setDate(r.docDate ?? "");
      setExpiry(r.expiryDate ?? "");
      setPrescriber(r.prescriber ?? "");
      if (r.prescriber) {
        const norm = r.prescriber.toLowerCase().replace(/^dr\.?\s*/, "");
        const found = getDoctors().find((d) => d.name && norm && (d.name.toLowerCase().includes(norm) || norm.includes(d.name.toLowerCase().replace(/^dr\.?\s*/, ""))));
        if (found) { setMatched(found); setDoctorId(found.id); } else { setCreateDoctor(true); }
      }
      setStep("review");
    } catch {
      setStep("review"); // let the user fill manually if OCR fails
    }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) run(f); };

  const save = async () => {
    if (!file) return;
    let linkedId = doctorId || undefined;
    if (!linkedId && createDoctor && prescriber.trim()) {
      const d = saveDoctor({ name: prescriber.trim(), specialty: "" });
      linkedId = d.id;
    }
    await saveDoc({
      type, title: title.trim() || "Document", date: date || undefined,
      expiryDate: expiry || undefined, prescriber: prescriber.trim() || undefined,
      notifyExpiry: !!expiry && notifyExpiry, doctorId: linkedId,
      mime: file.type, filename: file.name, blob: file,
    });
    onSaved(); onClose();
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[75] flex flex-col justify-end" role="dialog" aria-modal="true">
        <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-cream rounded-t-4xl max-h-[92vh] overflow-y-auto overscroll-none animate-sheetUp pb-safe">
          <div className="sticky top-0 bg-cream/95 backdrop-blur px-5 pt-3 pb-3 z-10">
            <div className="mx-auto h-1.5 w-10 rounded-full bg-black/10 mb-3" />
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold text-ink flex items-center gap-2"><ScanText className="h-5 w-5 text-brand-600" /> Scanner un document</h2>
              <button onClick={onClose} className="grid place-items-center h-10 w-10 rounded-2xl bg-white shadow-card text-ink-soft active:scale-95"><X className="h-5 w-5" /></button>
            </div>
          </div>

          <div className="px-5 pb-8">
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />

            {step === "capture" && (
              <div className="text-center py-6">
                <div className="mx-auto grid place-items-center h-20 w-20 rounded-3xl bg-lilac text-brand-700 mb-4"><Camera className="h-9 w-9" /></div>
                <p className="font-display text-lg font-semibold text-ink">Photographie ton document</p>
                <p className="text-sm text-ink-mute mt-1 mb-5 max-w-xs mx-auto">Ordonnance, certificat, analyse… Moody détecte le type, la date de péremption et le médecin. Résultats à vérifier.</p>
                <button onClick={() => fileRef.current?.click()} className="w-full rounded-3xl py-4 bg-brand-500 text-white font-display text-[17px] font-semibold shadow-glow flex items-center justify-center gap-2 active:scale-[.99]"><Camera className="h-5 w-5" /> Prendre une photo</button>
              </div>
            )}

            {step === "processing" && (
              <div className="text-center py-12">
                <Loader2 className="h-10 w-10 mx-auto text-brand-500 animate-spin mb-4" />
                <p className="font-display text-lg font-semibold text-ink">Lecture du document…</p>
                <p className="text-sm text-ink-mute mt-1">{Math.round(progress * 100)}%</p>
                <p className="text-[12px] text-ink-mute mt-3 max-w-xs mx-auto">Le moteur de lecture se télécharge la première fois — ça peut prendre quelques secondes.</p>
              </div>
            )}

            {step === "review" && (
              <div className="space-y-4">
                {preview && <img src={preview} alt="" className="w-full max-h-44 object-contain rounded-2xl bg-white shadow-card" />}
                <p className="text-[12.5px] text-ink-mute text-center">Vérifie et corrige si besoin.</p>

                <div>
                  <p className="text-[11px] font-bold tracking-widest uppercase text-ink-mute mb-1.5">Type détecté</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {DOC_TYPES.map((t) => <button key={t.key} onClick={() => setType(t.key)} className={`rounded-xl py-2 text-[12px] font-bold transition ${type === t.key ? "bg-brand-500 text-white" : "bg-cream text-ink-soft"}`}>{t.label}</button>)}
                  </div>
                </div>

                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre" className="w-full bg-white shadow-card rounded-xl px-3.5 py-3 font-semibold text-ink outline-none" />

                <div className="grid grid-cols-2 gap-2">
                  <label className="block"><span className="text-[11px] font-bold tracking-widest uppercase text-ink-mute">Date</span>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full bg-cream rounded-xl px-3 py-2.5 text-ink outline-none" /></label>
                  <label className="block"><span className="text-[11px] font-bold tracking-widest uppercase text-ink-mute">Péremption</span>
                    <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="mt-1 w-full bg-cream rounded-xl px-3 py-2.5 text-ink outline-none" /></label>
                </div>

                {/* prescriber / doctor */}
                <div className="card p-4 space-y-3">
                  <div className="flex items-center gap-2 text-brand-700"><Stethoscope className="h-4 w-4" /><span className="text-[11px] font-bold tracking-widest uppercase text-ink-soft">Médecin</span></div>
                  <input value={prescriber} onChange={(e) => { setPrescriber(e.target.value); setMatched(null); setDoctorId(""); }} placeholder="Nom détecté (Dr …)" className="w-full bg-cream rounded-xl px-3.5 py-2.5 font-semibold text-ink outline-none" />
                  {matched ? (
                    <p className="text-[13px] text-brand-700 font-semibold flex items-center gap-1.5"><Check className="h-4 w-4" /> Relié à {matched.name} ({matched.specialty || "spécialité ?"})</p>
                  ) : (
                    <>
                      <select value={doctorId} onChange={(e) => { setDoctorId(e.target.value); setCreateDoctor(false); }} className="w-full bg-cream rounded-xl px-3 py-2.5 text-ink outline-none">
                        <option value="">Relier à un médecin existant…</option>
                        {getDoctors().map((d) => <option key={d.id} value={d.id}>{d.name || "Médecin"}{d.specialty ? ` — ${d.specialty}` : ""}</option>)}
                      </select>
                      {prescriber.trim() && !doctorId && (
                        <button onClick={() => setCreateDoctor((c) => !c)} className={`w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 font-bold text-sm transition ${createDoctor ? "bg-brand-500 text-white" : "bg-cream text-brand-700"}`}>
                          <Plus className="h-4 w-4" /> Créer la fiche « {prescriber.trim()} »
                        </button>
                      )}
                    </>
                  )}
                </div>

                {expiry && (
                  <button onClick={() => setNotifyExpiry((n) => !n)} className="card w-full p-4 flex items-center gap-3 text-left">
                    <span className={`grid place-items-center h-10 w-10 rounded-2xl shrink-0 ${notifyExpiry ? "bg-brand-500 text-white" : "bg-cream text-brand-700"}`}><Bell className="h-5 w-5" /></span>
                    <div className="flex-1"><p className="font-bold text-ink text-[15px]">Alerte de péremption</p><p className="text-[12.5px] text-ink-mute">Notifier 30 j, 7 j et 1 j avant l'échéance</p></div>
                    <span className={`relative h-7 w-12 rounded-full transition ${notifyExpiry ? "bg-brand-500" : "bg-black/15"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${notifyExpiry ? "left-6" : "left-1"}`} /></span>
                  </button>
                )}

                <button onClick={save} className="w-full rounded-3xl py-4 bg-brand-500 text-white font-display text-[17px] font-semibold shadow-glow flex items-center justify-center gap-2 active:scale-[.99]"><Check className="h-5 w-5" strokeWidth={2.6} /> Enregistrer le document</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
