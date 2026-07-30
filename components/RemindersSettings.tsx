"use client";

import { useState } from "react";
import {
  useStore, getSettings, saveSettings, getMeds, saveMed, deleteMed, toggleModule,
  getAddictions, saveAddiction, deleteAddiction, Addiction,
  Medication, ReminderSettings, Slot, ALL_DAYS, DAY_LABELS, MODULES,
} from "@/lib/storage";
import { requestNotifPermission } from "@/lib/reminders";
import { setPin, disableSecurity, biometricsAvailable, registerFace } from "@/lib/security";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { MedicalVault } from "@/components/MedicalVault";
import { Portal } from "@/components/Portal";
import {
  X, Plus, Trash2, Bell, Volume2, ScanLine, Smile, Pill, Check, ChevronDown, Dumbbell, Droplets, SlidersHorizontal, ShieldCheck,
  UserRound, Lock, ScanFace, CloudSun, Delete, HeartPulse, ChevronRight,
} from "lucide-react";

function DayPicker({ days, onChange }: { days: number[]; onChange: (d: number[]) => void }) {
  const all = days.length === 0 || days.length === 7;
  const toggle = (d: number) => {
    const base = all ? [...ALL_DAYS] : [...days];
    const next = base.includes(d) ? base.filter((x) => x !== d) : [...base, d];
    onChange(next.length === 7 ? ALL_DAYS : next.sort());
  };
  return (
    <div className="flex gap-1">
      {DAY_LABELS.map((lbl, d) => {
        const on = all || days.includes(d);
        return (
          <button key={d} onClick={() => toggle(d)}
            className={`h-8 w-8 rounded-lg text-[12px] font-bold transition ${on ? "bg-brand-500 text-white" : "bg-brand-50 text-ink-mute"}`}>
            {lbl}
          </button>
        );
      })}
    </div>
  );
}

function SlotRow({ slot, onChange, onDelete }: { slot: Slot; onChange: (s: Slot) => void; onDelete: () => void }) {
  return (
    <div className="rounded-2xl bg-brand-50/60 p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <input type="time" value={slot.time} onChange={(e) => onChange({ ...slot, time: e.target.value })}
          className="flex-1 bg-white rounded-xl px-3 py-2.5 font-display font-semibold text-ink outline-none shadow-card" />
        <button onClick={onDelete} className="grid place-items-center h-10 w-10 rounded-xl bg-white text-red-400 shadow-card active:scale-95"><Trash2 className="h-[18px] w-[18px]" /></button>
      </div>
      <DayPicker days={slot.days} onChange={(d) => onChange({ ...slot, days: d })} />
    </div>
  );
}

export function RemindersSettings({ onClose }: { onClose: () => void }) {
  useStore();
  const [scanFor, setScanFor] = useState<string | null>(null);
  const [showVault, setShowVault] = useState(false);
  const settings: ReminderSettings = getSettings();
  const meds = getMeds();
  const patch = (p: Partial<ReminderSettings>) => saveSettings(p);

  const enableNotifs = async () => {
    const ok = await requestNotifPermission();
    patch({ notifications: ok });
    if (!ok) alert("Notifications refusées. Active-les dans les réglages de ton navigateur/téléphone.");
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex flex-col justify-end" role="dialog" aria-modal="true">
        <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-cream rounded-t-4xl max-h-[92vh] overflow-y-auto overscroll-none animate-sheetUp pb-safe">
          <div className="sticky top-0 bg-cream/95 backdrop-blur px-5 pt-3 pb-3 z-10">
            <div className="mx-auto h-1.5 w-10 rounded-full bg-black/10 mb-3" />
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold text-ink">Personnaliser</h2>
              <button onClick={onClose} className="grid place-items-center h-10 w-10 rounded-2xl bg-white shadow-card text-ink-soft active:scale-95"><X className="h-5 w-5" /></button>
            </div>
          </div>

          <div className="px-5 pb-8 space-y-6">
            {/* Profile */}
            <section>
              <SectionTitle icon={<UserRound className="h-4 w-4" />} title="Profil & accueil" hint="Personnalise ta page d'accueil" />
              <div className="card p-4 space-y-3">
                <input defaultValue={settings.name ?? ""} onBlur={(e) => patch({ name: e.target.value.trim() || undefined })}
                  placeholder="Ton prénom (pour le message d'accueil)" className="w-full bg-brand-50 rounded-xl px-3.5 py-3 font-semibold text-ink outline-none" />
                <input defaultValue={settings.mantra ?? ""} onBlur={(e) => patch({ mantra: e.target.value.trim() || undefined })}
                  placeholder="Ta phrase du moment (ex : Un jour à la fois)" className="w-full bg-brand-50 rounded-xl px-3.5 py-3 font-semibold text-ink outline-none" />
              </div>
              <div className="card mt-2">
                <Toggle icon={<CloudSun className="h-5 w-5" />} title="Météo en direct" sub="Affiche la météo de ta position sur l'accueil" on={!!settings.weather} onToggle={() => patch({ weather: !settings.weather })} />
              </div>
            </section>

            {/* Medical space */}
            <section>
              <SectionTitle icon={<HeartPulse className="h-4 w-4" />} title="Espace santé" hint="Fiche médicale, médecins, documents, rendez-vous" />
              <button onClick={() => setShowVault(true)} className="card w-full p-4 flex items-center gap-3.5 text-left active:scale-[.99]">
                <span className="grid place-items-center h-11 w-11 rounded-2xl bg-lilac text-brand-700 shrink-0"><HeartPulse className="h-[22px] w-[22px]" /></span>
                <div className="flex-1"><p className="font-bold text-ink text-[15px]">Ouvrir mon espace santé</p><p className="text-[12.5px] text-ink-mute">Fiche · médecins · ordonnances · RDV</p></div>
                <ChevronRight className="h-5 w-5 text-ink-mute" />
              </button>
            </section>

            {/* Mood times */}
            <section>
              <SectionTitle icon={<Smile className="h-4 w-4" />} title="Rappels d'humeur" hint="Aux heures (et jours) qui te vont" />
              <div className="card p-4 space-y-2.5">
                {settings.moodSlots.map((s, i) => (
                  <SlotRow key={i} slot={s}
                    onChange={(ns) => patch({ moodSlots: settings.moodSlots.map((x, j) => (j === i ? ns : x)) })}
                    onDelete={() => patch({ moodSlots: settings.moodSlots.filter((_, j) => j !== i) })} />
                ))}
                <button onClick={() => patch({ moodSlots: [...settings.moodSlots, { time: "12:00", days: ALL_DAYS }] })}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 bg-brand-50 text-brand-700 font-bold text-sm active:scale-[.98]">
                  <Plus className="h-4 w-4" /> Ajouter un horaire
                </button>
              </div>
            </section>

            {/* Medications */}
            <section>
              <SectionTitle icon={<Pill className="h-4 w-4" />} title="Médicaments" hint="Traitements, heures et jours de prise" />
              <div className="space-y-3">
                {meds.map((m) => <MedCard key={m.id} med={m} onSave={saveMed} onDelete={() => deleteMed(m.id)} onScan={() => setScanFor(m.id)} />)}
                <button onClick={() => saveMed({ name: "Nouveau médicament", slots: [{ time: "21:00", days: ALL_DAYS }] })}
                  className="w-full flex items-center justify-center gap-1.5 rounded-2xl py-3 bg-white shadow-card text-brand-700 font-bold text-sm active:scale-[.98]">
                  <Plus className="h-4 w-4" /> Ajouter un médicament
                </button>
              </div>
            </section>

            {/* Modules */}
            <section>
              <SectionTitle icon={<SlidersHorizontal className="h-4 w-4" />} title="Suivis en plus" hint="Active seulement ce qui t'est utile" />
              <div className="card divide-y divide-black/5">
                {MODULES.map((mod) => (
                  <Toggle key={mod.key}
                    icon={mod.key === "sport" ? <Dumbbell className="h-5 w-5" /> : <Droplets className="h-5 w-5" />}
                    title={mod.name} sub={mod.desc}
                    on={settings.modules.includes(mod.key)}
                    onToggle={() => toggleModule(mod.key)} />
                ))}
              </div>
              <p className="text-[12px] text-ink-mute mt-2 px-1">D'autres suivis (alimentation détaillée, objectifs…) arrivent — dis-moi tes besoins.</p>
            </section>

            {/* Addictions management */}
            {settings.modules.includes("addiction") && (
              <section>
                <SectionTitle icon={<ShieldCheck className="h-4 w-4" />} title="Mes addictions" hint="Ce que tu veux arrêter — un streak par entrée" />
                <div className="space-y-2">
                  {getAddictions().map((a) => <AddictionRow key={a.id} addiction={a} />)}
                  <button onClick={() => saveAddiction({ name: "" })}
                    className="w-full flex items-center justify-center gap-1.5 rounded-2xl py-3 bg-white shadow-card text-brand-700 font-bold text-sm active:scale-[.98]">
                    <Plus className="h-4 w-4" /> Ajouter une addiction
                  </button>
                </div>
              </section>
            )}

            {/* Alarm */}
            <section>
              <SectionTitle icon={<Bell className="h-4 w-4" />} title="Alarme" hint="Comportement quand l'app est ouverte" />
              <div className="card divide-y divide-black/5">
                <Toggle icon={<Volume2 className="h-5 w-5" />} title="Alarme forte (médicaments)" sub="Sonnerie longue en boucle jusqu'à validation" on={settings.loudAlarm} onToggle={() => patch({ loudAlarm: !settings.loudAlarm })} />
                <Toggle icon={<ScanLine className="h-5 w-5" />} title="Scan pour couper l'alarme" sub="Ne s'arrête qu'en scannant le médicament à la caméra" on={settings.scanToDismiss} onToggle={() => patch({ scanToDismiss: !settings.scanToDismiss })} />
              </div>
            </section>

            {/* Notifications */}
            <section>
              <SectionTitle icon={<Bell className="h-4 w-4" />} title="Notifications" hint="Pour être prévenu même hors de l'app (bip court)" />
              <button onClick={enableNotifs} className="w-full card p-4 flex items-center gap-3">
                <span className={`grid place-items-center h-10 w-10 rounded-2xl shrink-0 ${settings.notifications ? "bg-brand-500 text-white" : "bg-brand-50 text-brand-700"}`}>
                  {settings.notifications ? <Check className="h-5 w-5" strokeWidth={3} /> : <Bell className="h-5 w-5" />}
                </span>
                <div className="flex-1 text-left">
                  <p className="font-bold text-ink text-[15px]">{settings.notifications ? "Notifications activées" : "Activer les notifications"}</p>
                  <p className="text-[12.5px] text-ink-mute">Une PWA ne peut pas sonner fort quand elle est fermée (surtout iPhone).</p>
                </div>
              </button>
            </section>

            {/* Security */}
            <section>
              <SectionTitle icon={<Lock className="h-4 w-4" />} title="Sécurité" hint="Protège l'accès à l'app" />
              <SecurityBlock settings={settings} patch={patch} />
            </section>
          </div>
        </div>

        {scanFor && (
          <BarcodeScanner title="Scanne le code-barres du médicament"
            onResult={(code) => { const m = getMeds().find((x) => x.id === scanFor); if (m) saveMed({ ...m, barcode: code }); setScanFor(null); }}
            onClose={() => setScanFor(null)} />
        )}
      </div>
      {showVault && <MedicalVault onClose={() => setShowVault(false)} />}
    </Portal>
  );
}

function SectionTitle({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div className="px-1 mb-2.5">
      <div className="flex items-center gap-2 text-brand-700">{icon}<h3 className="font-display text-[16px] font-semibold text-ink">{title}</h3></div>
      <p className="text-[12.5px] text-ink-mute mt-0.5">{hint}</p>
    </div>
  );
}

function Toggle({ icon, title, sub, on, onToggle }: { icon: React.ReactNode; title: string; sub: string; on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="w-full flex items-center gap-3 p-4 text-left">
      <span className={`grid place-items-center h-10 w-10 rounded-2xl shrink-0 ${on ? "bg-brand-500 text-white" : "bg-brand-50 text-brand-700"}`}>{icon}</span>
      <div className="flex-1"><p className="font-bold text-ink text-[15px]">{title}</p><p className="text-[12.5px] text-ink-mute">{sub}</p></div>
      <span className={`relative h-7 w-12 rounded-full transition ${on ? "bg-brand-500" : "bg-black/15"}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-6" : "left-1"}`} />
      </span>
    </button>
  );
}

function SecurityBlock({ settings, patch }: { settings: ReminderSettings; patch: (p: Partial<ReminderSettings>) => void }) {
  const [setting, setSetting] = useState(false);
  const [stage, setStage] = useState<"first" | "confirm">("first");
  const [first, setFirst] = useState("");
  const [buf, setBuf] = useState("");
  const [err, setErr] = useState("");
  const faceOk = biometricsAvailable();

  const press = (d: string) => {
    if (buf.length >= 4) return;
    const nx = buf + d; setBuf(nx);
    if (nx.length === 4) {
      if (stage === "first") { setFirst(nx); setBuf(""); setStage("confirm"); setErr(""); }
      else {
        if (nx === first) { setPin(nx).then(() => { setSetting(false); setStage("first"); setFirst(""); setBuf(""); }); }
        else { setErr("Les codes ne correspondent pas."); setBuf(""); setStage("first"); setFirst(""); }
      }
    }
  };

  const toggleFace = async () => {
    if (settings.faceId) { patch({ faceId: false, faceCredId: undefined }); return; }
    const ok = await registerFace();
    if (!ok) alert("Biométrie indisponible ou refusée sur cet appareil.");
  };

  if (setting) {
    return (
      <div className="card p-5 flex flex-col items-center">
        <p className="font-display text-lg font-semibold text-ink">{stage === "first" ? "Choisis un code" : "Confirme le code"}</p>
        <p className="text-sm text-ink-mute mb-4">4 chiffres</p>
        <div className="flex gap-3 mb-5">
          {[0, 1, 2, 3].map((i) => <span key={i} className={`h-3.5 w-3.5 rounded-full ${i < buf.length ? "bg-brand-500" : "bg-black/12"}`} />)}
        </div>
        {err && <p className="text-sm text-red-500 mb-3">{err}</p>}
        <div className="grid grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button key={d} onClick={() => press(d)} className="h-14 w-14 rounded-full bg-brand-50 font-display text-xl font-semibold text-ink active:scale-90">{d}</button>
          ))}
          <span />
          <button onClick={() => press("0")} className="h-14 w-14 rounded-full bg-brand-50 font-display text-xl font-semibold text-ink active:scale-90">0</button>
          <button onClick={() => setBuf((b) => b.slice(0, -1))} className="h-14 w-14 rounded-full grid place-items-center text-ink-soft active:scale-90"><Delete className="h-5 w-5" /></button>
        </div>
        <button onClick={() => { setSetting(false); setStage("first"); setFirst(""); setBuf(""); setErr(""); }} className="mt-4 text-sm font-semibold text-ink-mute">Annuler</button>
      </div>
    );
  }

  return (
    <div className="card divide-y divide-black/5">
      <div className="flex items-center gap-3 p-4">
        <span className={`grid place-items-center h-10 w-10 rounded-2xl shrink-0 ${settings.pinEnabled ? "bg-brand-500 text-white" : "bg-brand-50 text-brand-700"}`}><Lock className="h-5 w-5" /></span>
        <div className="flex-1"><p className="font-bold text-ink text-[15px]">Code PIN</p><p className="text-[12.5px] text-ink-mute">{settings.pinEnabled ? "Activé — demandé à l'ouverture" : "4 chiffres pour ouvrir l'app"}</p></div>
        {settings.pinEnabled
          ? <button onClick={() => disableSecurity()} className="rounded-xl px-3.5 py-2 bg-white shadow-card text-red-500 font-bold text-sm active:scale-95">Désactiver</button>
          : <button onClick={() => setSetting(true)} className="rounded-xl px-3.5 py-2 bg-brand-500 text-white font-bold text-sm active:scale-95">Activer</button>}
      </div>

      {settings.pinEnabled && faceOk && (
        <Toggle icon={<ScanFace className="h-5 w-5" />} title="Face ID / biométrie" sub="Déverrouille avec ton visage ou ton empreinte" on={!!settings.faceId} onToggle={toggleFace} />
      )}
    </div>
  );
}

function AddictionRow({ addiction }: { addiction: Addiction }) {
  const [name, setName] = useState(addiction.name);
  return (
    <div className="card p-3 flex items-center gap-3">
      <span className="grid place-items-center h-10 w-10 rounded-2xl bg-lilac text-brand-700 shrink-0"><ShieldCheck className="h-5 w-5" /></span>
      <input
        value={name} onChange={(e) => setName(e.target.value)} autoFocus={addiction.name === ""}
        onBlur={() => saveAddiction({ ...addiction, name: name.trim() || "Addiction" })}
        placeholder="Ex : Cigarette, Alcool…"
        className="flex-1 bg-transparent font-semibold text-ink outline-none min-w-0" />
      <button onClick={() => deleteAddiction(addiction.id)} className="grid place-items-center h-9 w-9 rounded-xl bg-white text-red-400 shadow-card active:scale-95"><Trash2 className="h-[18px] w-[18px]" /></button>
    </div>
  );
}

function MedCard({ med, onSave, onDelete, onScan }: { med: Medication; onSave: (m: Medication) => void; onDelete: () => void; onScan: () => void }) {
  const [open, setOpen] = useState(med.name === "Nouveau médicament");
  const [name, setName] = useState(med.name);
  const [dose, setDose] = useState(med.dose ?? "");
  const commit = (extra?: Partial<Medication>) => onSave({ ...med, name: name.trim() || "Médicament", dose: dose.trim() || undefined, ...extra });

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <span className="grid place-items-center h-10 w-10 rounded-2xl bg-peach text-[#c8622f] shrink-0"><Pill className="h-5 w-5" /></span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-ink truncate">{med.name}</p>
          <p className="text-[12.5px] text-ink-mute truncate">{med.slots.map((s) => s.time).join(" · ") || "Pas d'horaire"}{med.barcode ? " · code ✓" : ""}</p>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="grid place-items-center h-9 w-9 rounded-xl bg-brand-50 text-brand-700 active:scale-95"><ChevronDown className={`h-5 w-5 transition ${open ? "rotate-180" : ""}`} /></button>
      </div>

      {open && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => commit()} placeholder="Nom" className="bg-brand-50 rounded-xl px-3 py-2.5 font-semibold text-ink outline-none" />
            <input value={dose} onChange={(e) => setDose(e.target.value)} onBlur={() => commit()} placeholder="Dose (ex: 50 mg)" className="bg-brand-50 rounded-xl px-3 py-2.5 font-semibold text-ink outline-none" />
          </div>

          <div>
            <p className="text-[11px] font-bold tracking-widest uppercase text-ink-mute mb-2">Prises</p>
            <div className="space-y-2">
              {med.slots.map((s, i) => (
                <SlotRow key={i} slot={s}
                  onChange={(ns) => onSave({ ...med, slots: med.slots.map((x, j) => (j === i ? ns : x)) })}
                  onDelete={() => onSave({ ...med, slots: med.slots.filter((_, j) => j !== i) })} />
              ))}
              <button onClick={() => onSave({ ...med, slots: [...med.slots, { time: "08:00", days: ALL_DAYS }] })}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 bg-brand-50 text-brand-700 font-bold text-sm active:scale-[.98]"><Plus className="h-4 w-4" /> Ajouter une prise</button>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={onScan} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 bg-ink text-white font-bold text-sm active:scale-[.98]"><ScanLine className="h-4 w-4" /> {med.barcode ? "Re-scanner le code" : "Enregistrer le code-barres"}</button>
            <button onClick={onDelete} className="grid place-items-center h-11 w-11 rounded-xl bg-white text-red-400 shadow-card active:scale-95"><Trash2 className="h-5 w-5" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
