"use client";

import { useEffect, useState } from "react";
import {
  getSettings, saveSettings, getMeds, saveMed, deleteMed, onChange,
  Medication, ReminderSettings,
} from "@/lib/storage";
import { requestNotifPermission } from "@/lib/reminders";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { Portal } from "@/components/Portal";
import {
  X, Plus, Trash2, Clock, Bell, Volume2, ScanLine, Smile, Pill, Check, ChevronDown,
} from "lucide-react";

export function RemindersSettings({ onClose }: { onClose: () => void }) {
  const [tick, setTick] = useState(0);
  useEffect(() => onChange(() => setTick((t) => t + 1)), []);

  const [settings, setSettings] = useState<ReminderSettings>(() => getSettings());
  const [meds, setMeds] = useState<Medication[]>(() => getMeds());
  const [scanFor, setScanFor] = useState<string | null>(null); // med id being registered

  useEffect(() => { setSettings(getSettings()); setMeds(getMeds()); }, [tick]);

  const patch = (p: Partial<ReminderSettings>) => setSettings(saveSettings(p));

  const enableNotifs = async () => {
    const ok = await requestNotifPermission();
    patch({ notifications: ok });
    if (!ok) alert("Notifications refusées. Active-les dans les réglages de ton navigateur/téléphone.");
  };

  return (
    <Portal>
    <div className="fixed inset-0 z-[60] flex flex-col justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-cream rounded-t-4xl max-h-[90vh] overflow-y-auto animate-sheetUp pb-safe">
        {/* handle + header */}
        <div className="sticky top-0 bg-cream/95 backdrop-blur px-5 pt-3 pb-3 z-10">
          <div className="mx-auto h-1.5 w-10 rounded-full bg-black/10 mb-3" />
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold text-ink">Rappels</h2>
            <button onClick={onClose} className="grid place-items-center h-10 w-10 rounded-2xl bg-white shadow-card text-ink-soft active:scale-95">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="px-5 pb-8 space-y-6">
          {/* Mood times */}
          <section>
            <SectionTitle icon={<Smile className="h-4 w-4" />} title="Humeur" hint="Quand te rappeler de noter ton humeur" />
            <div className="card p-4 space-y-2.5">
              {settings.moodTimes.length === 0 && <p className="text-sm text-ink-mute">Aucun horaire.</p>}
              {settings.moodTimes.map((t, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-ink-mute" />
                  <input
                    type="time" value={t}
                    onChange={(e) => {
                      const times = [...settings.moodTimes]; times[i] = e.target.value;
                      patch({ moodTimes: times.sort() });
                    }}
                    className="flex-1 bg-brand-50 rounded-xl px-3 py-2.5 font-display font-semibold text-ink outline-none"
                  />
                  <button onClick={() => patch({ moodTimes: settings.moodTimes.filter((_, j) => j !== i) })}
                    className="grid place-items-center h-9 w-9 rounded-xl bg-white text-red-400 shadow-card active:scale-95">
                    <Trash2 className="h-[18px] w-[18px]" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => patch({ moodTimes: [...settings.moodTimes, "12:00"].sort() })}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 bg-brand-50 text-brand-700 font-bold text-sm active:scale-[.98]"
              >
                <Plus className="h-4 w-4" /> Ajouter un horaire
              </button>
            </div>
          </section>

          {/* Medications */}
          <section>
            <SectionTitle icon={<Pill className="h-4 w-4" />} title="Médicaments" hint="Traitements et heures de prise" />
            <div className="space-y-3">
              {meds.map((m) => (
                <MedCard key={m.id} med={m}
                  onSave={(x) => saveMed(x)}
                  onDelete={() => deleteMed(m.id)}
                  onScan={() => setScanFor(m.id)}
                />
              ))}
              <button
                onClick={() => saveMed({ name: "Nouveau médicament", times: ["21:00"] })}
                className="w-full flex items-center justify-center gap-1.5 rounded-2xl py-3 bg-white shadow-card text-brand-700 font-bold text-sm active:scale-[.98]"
              >
                <Plus className="h-4 w-4" /> Ajouter un médicament
              </button>
            </div>
          </section>

          {/* Alarm behaviour */}
          <section>
            <SectionTitle icon={<Bell className="h-4 w-4" />} title="Alarme" hint="Comportement quand l'app est ouverte" />
            <div className="card divide-y divide-black/5">
              <Toggle
                icon={<Volume2 className="h-5 w-5" />}
                title="Alarme forte (médicaments)"
                sub="Sonnerie longue et bruyante en boucle jusqu'à validation"
                on={settings.loudAlarm}
                onToggle={() => patch({ loudAlarm: !settings.loudAlarm })}
              />
              <Toggle
                icon={<ScanLine className="h-5 w-5" />}
                title="Scan pour couper l'alarme"
                sub="Impossible d'arrêter sans scanner le médicament à la caméra"
                on={settings.scanToDismiss}
                onToggle={() => patch({ scanToDismiss: !settings.scanToDismiss })}
              />
              <div className="flex items-center gap-3 p-4">
                <span className="grid place-items-center h-10 w-10 rounded-2xl bg-brand-50 text-brand-700 shrink-0"><Clock className="h-5 w-5" /></span>
                <div className="flex-1">
                  <p className="font-bold text-ink text-[15px]">Relance si non validé</p>
                  <p className="text-[12.5px] text-ink-mute">L'alarme se répète après ce délai</p>
                </div>
                <span className="font-display font-semibold text-ink">{settings.snoozeMinutes} min</span>
              </div>
            </div>
          </section>

          {/* Notifications */}
          <section>
            <SectionTitle icon={<Bell className="h-4 w-4" />} title="Notifications" hint="Pour être prévenu même hors de l'app (bip court)" />
            <button
              onClick={enableNotifs}
              className={`w-full card p-4 flex items-center gap-3 ${settings.notifications ? "opacity-100" : ""}`}
            >
              <span className={`grid place-items-center h-10 w-10 rounded-2xl shrink-0 ${settings.notifications ? "bg-brand-500 text-white" : "bg-brand-50 text-brand-700"}`}>
                {settings.notifications ? <Check className="h-5 w-5" strokeWidth={3} /> : <Bell className="h-5 w-5" />}
              </span>
              <div className="flex-1 text-left">
                <p className="font-bold text-ink text-[15px]">{settings.notifications ? "Notifications activées" : "Activer les notifications"}</p>
                <p className="text-[12.5px] text-ink-mute">
                  Note : une PWA ne peut pas sonner fort quand elle est fermée (surtout sur iPhone).
                </p>
              </div>
            </button>
          </section>
        </div>
      </div>

      {scanFor && (
        <BarcodeScanner
          title="Scanne le code-barres du médicament"
          onResult={(code) => {
            const m = getMeds().find((x) => x.id === scanFor);
            if (m) saveMed({ ...m, barcode: code });
            setScanFor(null);
          }}
          onClose={() => setScanFor(null)}
        />
      )}
    </div>
    </Portal>
  );
}

function SectionTitle({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div className="px-1 mb-2.5">
      <div className="flex items-center gap-2 text-brand-700">{icon}
        <h3 className="font-display text-[16px] font-semibold text-ink">{title}</h3>
      </div>
      <p className="text-[12.5px] text-ink-mute mt-0.5">{hint}</p>
    </div>
  );
}

function Toggle({ icon, title, sub, on, onToggle }: {
  icon: React.ReactNode; title: string; sub: string; on: boolean; onToggle: () => void;
}) {
  return (
    <button onClick={onToggle} className="w-full flex items-center gap-3 p-4 text-left">
      <span className={`grid place-items-center h-10 w-10 rounded-2xl shrink-0 ${on ? "bg-brand-500 text-white" : "bg-brand-50 text-brand-700"}`}>{icon}</span>
      <div className="flex-1">
        <p className="font-bold text-ink text-[15px]">{title}</p>
        <p className="text-[12.5px] text-ink-mute">{sub}</p>
      </div>
      <span className={`relative h-7 w-12 rounded-full transition ${on ? "bg-brand-500" : "bg-black/15"}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-6" : "left-1"}`} />
      </span>
    </button>
  );
}

function MedCard({ med, onSave, onDelete, onScan }: {
  med: Medication; onSave: (m: Medication) => void; onDelete: () => void; onScan: () => void;
}) {
  const [open, setOpen] = useState(med.name === "Nouveau médicament");
  const [name, setName] = useState(med.name);
  const [dose, setDose] = useState(med.dose ?? "");

  const commit = (extra?: Partial<Medication>) =>
    onSave({ ...med, name: name.trim() || "Médicament", dose: dose.trim() || undefined, ...extra });

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <span className="grid place-items-center h-10 w-10 rounded-2xl bg-peach text-[#c8622f] shrink-0"><Pill className="h-5 w-5" /></span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-ink truncate">{med.name}</p>
          <p className="text-[12.5px] text-ink-mute truncate">
            {med.times.join(" · ") || "Pas d'horaire"}{med.barcode ? " · code enregistré" : ""}
          </p>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="grid place-items-center h-9 w-9 rounded-xl bg-brand-50 text-brand-700 active:scale-95">
          <ChevronDown className={`h-5 w-5 transition ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => commit()} placeholder="Nom"
              className="bg-brand-50 rounded-xl px-3 py-2.5 font-semibold text-ink outline-none" />
            <input value={dose} onChange={(e) => setDose(e.target.value)} onBlur={() => commit()} placeholder="Dose (ex: 50 mg)"
              className="bg-brand-50 rounded-xl px-3 py-2.5 font-semibold text-ink outline-none" />
          </div>

          <div>
            <p className="text-[11px] font-bold tracking-widest uppercase text-ink-mute mb-2">Heures de prise</p>
            <div className="flex flex-wrap items-center gap-2">
              {med.times.map((t, i) => (
                <span key={i} className="flex items-center gap-1 bg-brand-50 rounded-xl pl-2 pr-1 py-1">
                  <input type="time" value={t}
                    onChange={(e) => { const times = [...med.times]; times[i] = e.target.value; onSave({ ...med, times: times.sort() }); }}
                    className="bg-transparent font-display font-semibold text-ink outline-none" />
                  <button onClick={() => onSave({ ...med, times: med.times.filter((_, j) => j !== i) })}
                    className="grid place-items-center h-6 w-6 rounded-lg text-red-400"><X className="h-4 w-4" /></button>
                </span>
              ))}
              <button onClick={() => onSave({ ...med, times: [...med.times, "08:00"].sort() })}
                className="grid place-items-center h-9 w-9 rounded-xl bg-brand-500 text-white active:scale-95"><Plus className="h-4 w-4" /></button>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={onScan} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 bg-ink text-white font-bold text-sm active:scale-[.98]">
              <ScanLine className="h-4 w-4" /> {med.barcode ? "Re-scanner le code" : "Enregistrer le code-barres"}
            </button>
            <button onClick={onDelete} className="grid place-items-center h-11 w-11 rounded-xl bg-white text-red-400 shadow-card active:scale-95">
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
