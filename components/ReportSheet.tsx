"use client";

import { useState } from "react";
import {
  getEntries, getMeds, dosesForDate, isMedTaken, getSettings,
  moodLabel, ENERGY_LABELS, APPETITE_LABELS,
} from "@/lib/storage";
import { aiNarrative } from "@/lib/ai";
import { Portal } from "@/components/Portal";
import { X, FileText, Sparkles, Loader2, Download, UserRound, HeartPulse } from "lucide-react";

type Period = 7 | 30 | 90;
type Kind = "perso" | "therapeute";
type Step = "idle" | "working" | "done" | "error";

function rangeDates(days: number): string[] {
  const out: string[] = []; const d = new Date();
  for (let i = days - 1; i >= 0; i--) { const x = new Date(d); x.setDate(d.getDate() - i); out.push(x.toISOString().slice(0, 10)); }
  return out;
}
function avg(a: number[]) { return a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : null; }

export function ReportSheet({ onClose }: { onClose: () => void }) {
  const [period, setPeriod] = useState<Period>(30);
  const [kind, setKind] = useState<Kind>("perso");
  const [step, setStep] = useState<Step>("idle");
  const [err, setErr] = useState("");

  const build = () => {
    const dates = rangeDates(period);
    const start = dates[0], end = dates[dates.length - 1];
    const entries = getEntries().filter((e) => e.date >= start && e.date <= end);
    const moods = entries.map((e) => e.mood);
    const daysLogged = new Set(entries.map((e) => e.date)).size;
    const half = Math.floor(entries.length / 2);
    const trendA = avg(entries.slice(half).map((e) => e.mood));
    const trendB = avg(entries.slice(0, half).map((e) => e.mood));
    const trend = trendA == null || trendB == null ? "stable" : trendA - trendB > 0.5 ? "en amélioration" : trendB - trendA > 0.5 ? "en baisse" : "stable";

    // adherence
    const today = new Date().toISOString().slice(0, 10);
    let scheduled = 0, taken = 0;
    const perMed: Record<string, { name: string; sched: number; taken: number }> = {};
    for (const d of dates) {
      if (d > today) continue;
      for (const dose of dosesForDate(d)) {
        scheduled++; const ok = isMedTaken(d, dose.medId, dose.time);
        if (ok) taken++;
        perMed[dose.medId] ??= { name: dose.name, sched: 0, taken: 0 };
        perMed[dose.medId].sched++; if (ok) perMed[dose.medId].taken++;
      }
    }
    const adherence = scheduled ? Math.round((taken / scheduled) * 100) : null;

    return {
      start, end, entries, daysLogged, trend,
      moodAvg: avg(moods), moodMin: moods.length ? Math.min(...moods) : null, moodMax: moods.length ? Math.max(...moods) : null,
      energyAvg: avg(entries.map((e) => e.energy).filter((x): x is number => x != null)),
      appetiteAvg: avg(entries.map((e) => e.appetite).filter((x): x is number => x != null)),
      sleepAvg: avg(entries.map((e) => e.sleep).filter((x): x is number => x != null)),
      adherence, perMed: Object.values(perMed),
      notes: entries.filter((e) => e.note).slice(-8).map((e) => ({ date: e.date, note: e.note! })),
    };
  };

  const generate = async () => {
    setStep("working"); setErr("");
    try {
      const s = build();
      const fmt = (v: number | null, suffix = "") => (v == null ? "—" : `${v}${suffix}`);
      const facts = [
        `Période : ${s.start} au ${s.end} (${period} jours).`,
        `Jours renseignés : ${s.daysLogged}/${period}.`,
        `Humeur moyenne : ${fmt(s.moodAvg)}/10 (min ${fmt(s.moodMin)}, max ${fmt(s.moodMax)}), tendance ${s.trend}.`,
        s.energyAvg != null ? `Énergie moyenne : ${ENERGY_LABELS[Math.round(s.energyAvg) - 1] ?? s.energyAvg} (${s.energyAvg}/5).` : "",
        s.appetiteAvg != null ? `Appétit moyen : ${APPETITE_LABELS[Math.round(s.appetiteAvg) - 1] ?? s.appetiteAvg} (${s.appetiteAvg}/4).` : "",
        s.sleepAvg != null ? `Sommeil moyen : ${s.sleepAvg} h/nuit.` : "",
        s.adherence != null ? `Observance des traitements : ${s.adherence}% (${s.perMed.map((m) => `${m.name} ${Math.round((m.taken / m.sched) * 100)}%`).join(", ")}).` : "Aucun traitement suivi.",
        s.notes.length ? `Notes récentes : ${s.notes.map((n) => `${n.date} — ${n.note}`).join(" | ")}` : "",
      ].filter(Boolean).join("\n");

      const system = kind === "therapeute"
        ? "Tu es un assistant clinique. Rédige en français un résumé factuel à la 3e personne destiné à un professionnel de santé (thérapeute/médecin). Neutre, structuré, sans diagnostic ni conseil médical. 150-220 mots."
        : "Tu es un accompagnant bienveillant. Rédige en français un bilan personnel chaleureux et encourageant à la 2e personne (tutoiement), sans jargon ni diagnostic. 150-220 mots.";

      let ai = "";
      try { ai = await aiNarrative(`Voici les données de suivi d'humeur et de traitement :\n${facts}\n\nRédige l'analyse.`, system); }
      catch { ai = "(Analyse IA indisponible — vérifie ta connexion. Le rapport chiffré ci-dessous reste complet.)"; }

      await makePdf(s, ai, kind, period);
      setStep("done");
    } catch (e: any) {
      setErr(e?.message ?? "Erreur"); setStep("error");
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex flex-col justify-end" role="dialog" aria-modal="true">
        <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-cream rounded-t-4xl max-h-[92vh] overflow-y-auto overscroll-none animate-sheetUp pb-safe">
          <div className="sticky top-0 bg-cream/95 backdrop-blur px-5 pt-3 pb-3 z-10">
            <div className="mx-auto h-1.5 w-10 rounded-full bg-black/10 mb-3" />
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold text-ink">Rapport</h2>
              <button onClick={onClose} className="grid place-items-center h-10 w-10 rounded-2xl bg-white shadow-card text-ink-soft active:scale-95"><X className="h-5 w-5" /></button>
            </div>
          </div>

          <div className="px-5 pb-8 space-y-6">
            <p className="text-[13.5px] text-ink-soft px-1">Un rapport PDF de ton humeur et de tes traitements, avec une analyse générée par IA. À partager avec ton médecin ou pour toi.</p>

            <section>
              <p className="text-[11px] font-bold tracking-widest uppercase text-ink-mute mb-2 px-1">Période</p>
              <div className="grid grid-cols-3 gap-2">
                {([7, 30, 90] as Period[]).map((p) => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className={`rounded-2xl py-3 font-display font-semibold transition active:scale-95 ${period === p ? "bg-brand-500 text-white shadow-glow" : "bg-white shadow-card text-ink-soft"}`}>
                    {p === 7 ? "7 jours" : p === 30 ? "30 jours" : "3 mois"}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <p className="text-[11px] font-bold tracking-widest uppercase text-ink-mute mb-2 px-1">Format</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setKind("perso")} className={`rounded-2xl p-4 text-left transition active:scale-[.98] ${kind === "perso" ? "bg-brand-500 text-white shadow-glow" : "bg-white shadow-card"}`}>
                  <HeartPulse className={`h-5 w-5 mb-1.5 ${kind === "perso" ? "text-white" : "text-brand-600"}`} />
                  <p className="font-bold text-[14px]">Perso</p>
                  <p className={`text-[12px] ${kind === "perso" ? "text-white/80" : "text-ink-mute"}`}>Bilan chaleureux pour toi</p>
                </button>
                <button onClick={() => setKind("therapeute")} className={`rounded-2xl p-4 text-left transition active:scale-[.98] ${kind === "therapeute" ? "bg-brand-500 text-white shadow-glow" : "bg-white shadow-card"}`}>
                  <UserRound className={`h-5 w-5 mb-1.5 ${kind === "therapeute" ? "text-white" : "text-brand-600"}`} />
                  <p className="font-bold text-[14px]">Thérapeute</p>
                  <p className={`text-[12px] ${kind === "therapeute" ? "text-white/80" : "text-ink-mute"}`}>Résumé clinique 3e personne</p>
                </button>
              </div>
            </section>

            {step === "error" && <p className="text-sm text-red-500 px-1">Erreur : {err}</p>}
            {step === "done" && <p className="text-sm text-brand-700 font-semibold px-1 flex items-center gap-1.5"><Download className="h-4 w-4" /> PDF téléchargé.</p>}

            <button onClick={generate} disabled={step === "working"}
              className="w-full rounded-3xl py-4 font-display text-[17px] font-semibold text-white flex items-center justify-center gap-2 bg-brand-500 shadow-glow disabled:opacity-60 active:scale-[.99]">
              {step === "working" ? <><Loader2 className="h-5 w-5 animate-spin" /> Génération…</> : <><Sparkles className="h-5 w-5" /> Générer le rapport PDF</>}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

async function makePdf(s: any, ai: string, kind: Kind, period: number) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const M = 18; let y = 22; const W = 210 - M * 2;
  const line = (txt: string, size = 11, bold = false, color: [number, number, number] = [22, 33, 27]) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(...color);
    const lines = doc.splitTextToSize(txt, W);
    for (const l of lines) { if (y > 275) { doc.addPage(); y = 22; } doc.text(l, M, y); y += size * 0.52 + 1.5; }
  };
  const gap = (n = 4) => { y += n; };

  doc.setFillColor(26, 173, 85); doc.rect(0, 0, 210, 8, "F");
  line("Moody — Rapport de suivi", 20, true);
  line(`${kind === "therapeute" ? "Résumé clinique" : "Bilan personnel"} · ${period} jours · ${s.start} → ${s.end}`, 10, false, [120, 130, 124]);
  gap(3);

  line("Humeur", 13, true, [18, 138, 67]);
  line(`Moyenne : ${s.moodAvg ?? "—"}/10${s.moodAvg != null ? ` (${moodLabel(s.moodAvg)})` : ""} · min ${s.moodMin ?? "—"} · max ${s.moodMax ?? "—"} · tendance ${s.trend}`);
  line(`Jours renseignés : ${s.daysLogged}/${period}`);
  if (s.energyAvg != null) line(`Énergie moyenne : ${s.energyAvg}/5`);
  if (s.appetiteAvg != null) line(`Appétit moyen : ${s.appetiteAvg}/4`);
  if (s.sleepAvg != null) line(`Sommeil moyen : ${s.sleepAvg} h/nuit`);
  gap(3);

  line("Traitements", 13, true, [18, 138, 67]);
  if (s.adherence == null) line("Aucun traitement suivi sur la période.");
  else { line(`Observance globale : ${s.adherence}%`); for (const m of s.perMed) line(`• ${m.name} : ${Math.round((m.taken / m.sched) * 100)}% (${m.taken}/${m.sched} prises)`); }
  gap(3);

  line("Analyse", 13, true, [18, 138, 67]);
  line(ai || "—");
  gap(4);

  if (s.notes.length) { line("Notes", 13, true, [18, 138, 67]); for (const n of s.notes) line(`${n.date} — ${n.note}`, 10, false, [80, 90, 84]); gap(3); }

  doc.setFontSize(8.5); doc.setTextColor(150, 158, 152);
  doc.text("Généré par Moody · données auto-déclarées, ne constitue pas un diagnostic médical.", M, 288);

  doc.save(`moody-rapport-${s.end}.pdf`);
}
