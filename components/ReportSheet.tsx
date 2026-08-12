"use client";

import { useEffect, useState } from "react";
import {
  getEntries, dosesForDate, isMedTaken, getSettings, dailySeries, getMeds,
  getMedicalProfile, ageFrom, ENERGY_LABELS, APPETITE_LABELS,
} from "@/lib/storage";
import { getHealthSnapshot } from "@/lib/health";
import { aiNarrative, aiUsesLeft, AI_WEEKLY_MAX, AIQuotaError } from "@/lib/ai";
import { saveReport, listReports, getReportBlob, deleteReport, downloadBlob, shareBlob, ReportMeta } from "@/lib/reports-db";
import { Portal } from "@/components/Portal";
import { X, Sparkles, Loader2, Download, UserRound, HeartPulse, History, Trash2, FileText, Share2 } from "lucide-react";

type Period = 7 | 30 | 90;
type Kind = "perso" | "therapeute";
type Step = "idle" | "working" | "done" | "error";

function avg(a: number[]) { return a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : null; }
function median(a: number[]) { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round(((s[m - 1] + s[m]) / 2) * 10) / 10; }
function frDate(ms: number) { return new Date(ms).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
function shortDate(iso: string) { const [y, m, d] = iso.split("-"); return `${d}/${m}`; }

export function ReportSheet({ onClose }: { onClose: () => void }) {
  const [period, setPeriod] = useState<Period>(30);
  const [kind, setKind] = useState<Kind>("therapeute");
  const [step, setStep] = useState<Step>("idle");
  const [err, setErr] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ReportMeta[]>([]);

  const refresh = () => listReports().then(setHistory).catch(() => {});
  useEffect(() => { refresh(); }, []);

  const build = () => {
    const series = dailySeries(period);
    const start = series[0].date, end = series[series.length - 1].date;
    const all = getEntries();
    const entries = all.filter((e) => e.date >= start && e.date <= end);
    const moods = entries.map((e) => e.mood);
    const daysLogged = new Set(entries.map((e) => e.date)).size;

    // trend (first vs second half of logged entries)
    const half = Math.floor(entries.length / 2);
    const tA = avg(entries.slice(half).map((e) => e.mood)), tB = avg(entries.slice(0, half).map((e) => e.mood));
    const trend = tA == null || tB == null ? "stable" : tA - tB > 0.5 ? "en amélioration" : tB - tA > 0.5 ? "en baisse" : "stable";

    // previous same-length period, for comparison
    const wide = dailySeries(period * 2);
    const prev = wide.slice(0, period);
    const prevEntries = all.filter((e) => e.date >= prev[0].date && e.date <= prev[prev.length - 1].date);
    const prevMoodAvg = avg(prevEntries.map((e) => e.mood));

    // mood distribution (1..10)
    const dist = Array(10).fill(0) as number[];
    moods.forEach((m) => { const b = Math.min(10, Math.max(1, Math.round(m))); dist[b - 1]++; });

    // medication adherence
    const today = new Date().toISOString().slice(0, 10);
    let scheduled = 0, taken = 0;
    const perMed: Record<string, { name: string; sched: number; taken: number }> = {};
    for (const d of series.map((s) => s.date)) {
      if (d > today) continue;
      for (const dose of dosesForDate(d)) {
        scheduled++; const ok = isMedTaken(d, dose.medId, dose.time);
        if (ok) taken++;
        perMed[dose.medId] ??= { name: dose.name, sched: 0, taken: 0 };
        perMed[dose.medId].sched++; if (ok) perMed[dose.medId].taken++;
      }
    }

    // symptom frequency
    const symFreq: Record<string, number> = {};
    entries.forEach((e) => (e.symptoms ?? []).forEach((sy) => { symFreq[sy] = (symFreq[sy] ?? 0) + 1; }));

    const moodAvg = avg(moods);
    return {
      start, end, series, entries, daysLogged, trend,
      totalEntries: entries.length,
      moodAvg, moodMedian: median(moods), moodMin: moods.length ? Math.min(...moods) : null, moodMax: moods.length ? Math.max(...moods) : null,
      moodDelta: moodAvg != null && prevMoodAvg != null ? Math.round((moodAvg - prevMoodAvg) * 10) / 10 : null,
      dist,
      energyAvg: avg(entries.map((e) => e.energy).filter((x): x is number => x != null)),
      appetiteAvg: avg(entries.map((e) => e.appetite).filter((x): x is number => x != null)),
      sleepAvg: avg(entries.map((e) => e.sleep).filter((x): x is number => x != null)),
      sleepMin: (() => { const v = entries.map((e) => e.sleep).filter((x): x is number => x != null); return v.length ? Math.min(...v) : null; })(),
      sleepMax: (() => { const v = entries.map((e) => e.sleep).filter((x): x is number => x != null); return v.length ? Math.max(...v) : null; })(),
      adherence: scheduled ? Math.round((taken / scheduled) * 100) : null,
      scheduled, taken,
      perMed: Object.values(perMed),
      medsFull: getMeds().map((m) => ({ name: m.name, dose: m.dose, times: m.slots.map((s) => s.time), perDay: m.slots.length })),
      profile: getMedicalProfile(),
      age: ageFrom(getMedicalProfile().birthDate),
      health: getHealthSnapshot(),
      symFreq: Object.entries(symFreq).sort((a, b) => b[1] - a[1]),
      notes: entries.filter((e) => e.note).slice(-10).map((e) => ({ date: e.date, note: e.note! })),
      symptomLog: entries.filter((e) => e.symptoms && e.symptoms.length).map((e) => ({
        date: e.date, symptoms: e.symptoms!, intensity: e.symptomIntensity, note: e.symptomNote,
      })),
      sideEffects: getMeds().flatMap((m) => (m.sideEffects ?? []).filter((x) => x.date >= start && x.date <= end).map((x) => ({ med: m.name, date: x.date, text: x.text }))),
    };
  };

  const generate = async () => {
    setStep("working"); setErr("");
    try {
      const s = build();
      const name = getSettings().name;
      const facts = [
        `Période : ${s.start} au ${s.end} (${period} jours).`,
        `Jours renseignés : ${s.daysLogged}/${period} (${s.totalEntries} saisies).`,
        `Humeur : moyenne ${s.moodAvg ?? "—"}/10, médiane ${s.moodMedian ?? "—"}, min ${s.moodMin ?? "—"}, max ${s.moodMax ?? "—"}, tendance ${s.trend}${s.moodDelta != null ? `, ${s.moodDelta >= 0 ? "+" : ""}${s.moodDelta} vs période précédente` : ""}.`,
        s.energyAvg != null ? `Énergie : ${ENERGY_LABELS[Math.round(s.energyAvg) - 1] ?? s.energyAvg} (${s.energyAvg}/5).` : "",
        s.appetiteAvg != null ? `Appétit : ${APPETITE_LABELS[Math.round(s.appetiteAvg) - 1] ?? s.appetiteAvg} (${s.appetiteAvg}/4).` : "",
        s.sleepAvg != null ? `Sommeil : ${s.sleepAvg} h/nuit (min ${s.sleepMin}, max ${s.sleepMax}).` : "",
        s.health ? `Santé connectée : ${s.health.sleepHours != null ? `sommeil ${s.health.sleepHours} h, ` : ""}${s.health.restingHR != null ? `FC repos ${s.health.restingHR} bpm, ` : ""}${s.health.steps != null ? `${s.health.steps} pas.` : ""}` : "",
        s.adherence != null ? `Observance : ${s.adherence}% (${s.taken}/${s.scheduled} prises) — ${s.perMed.map((m) => `${m.name} ${Math.round((m.taken / m.sched) * 100)}%`).join(", ")}.` : "Aucun traitement suivi.",
        s.profile.conditionsList?.length ? `Pathologies déclarées : ${s.profile.conditionsList.join(", ")}.` : "",
        s.profile.allergies ? `Allergies : ${s.profile.allergies}.` : "",
        s.symFreq.length ? `Symptômes (fréquence) : ${s.symFreq.map(([sy, n]) => `${sy} ×${n}`).join(", ")}.` : "",
        s.sideEffects.length ? `Effets indésirables : ${s.sideEffects.map((x: any) => `${x.med} — ${x.text} (${x.date})`).join(" | ")}` : "",
        s.notes.length ? `Notes : ${s.notes.map((n) => `${n.date} — ${n.note}`).join(" | ")}` : "",
      ].filter(Boolean).join("\n");

      const system = kind === "therapeute"
        ? "Tu es un assistant clinique. Rédige en français un résumé factuel et structuré à la 3e personne pour un professionnel de santé (psychiatre/psychologue). Neutre, précis, sans diagnostic ni conseil médical. Évoque l'évolution de l'humeur, le sommeil, l'observance, les symptômes et effets indésirables notables. 180-260 mots. N'invente aucune donnée."
        : "Tu es un accompagnant bienveillant. Rédige en français un bilan personnel chaleureux au tutoiement, sans jargon ni diagnostic. 150-220 mots.";
      let ai = "";
      try { ai = await aiNarrative(`Données de suivi${name ? ` de ${name}` : ""} :\n${facts}\n\nRédige l'analyse.`, system); }
      catch (e) { ai = e instanceof AIQuotaError
        ? "(Quota IA de la semaine atteint — analyse non générée. Le rapport chiffré ci-dessous reste complet.)"
        : "(Analyse IA indisponible — le rapport chiffré ci-dessous reste complet.)"; }

      const blob = await makePdf(s, ai, kind, period, name);
      const filename = `moody-rapport-${kind}-${s.end}.pdf`;
      await saveReport({ blob, kind, period, name: filename });
      downloadBlob(blob, filename);
      await refresh();
      setStep("done");
    } catch (e: any) { setErr(e?.message ?? "Erreur"); setStep("error"); }
  };

  const dl = async (m: ReportMeta) => { const b = await getReportBlob(m.id); if (b) downloadBlob(b, m.name); };
  const share = async (m: ReportMeta) => { const b = await getReportBlob(m.id); if (b) await shareBlob(b, m.name); };
  const del = async (m: ReportMeta) => { await deleteReport(m.id); await refresh(); };

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex flex-col justify-end" role="dialog" aria-modal="true">
        <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-cream rounded-t-4xl max-h-[92vh] overflow-y-auto overscroll-none animate-sheetUp pb-safe">
          <div className="sticky top-0 bg-cream/95 backdrop-blur px-5 pt-3 pb-3 z-10">
            <div className="mx-auto h-1.5 w-10 rounded-full bg-black/10 mb-3" />
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold text-ink">{showHistory ? "Historique" : "Rapport"}</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowHistory((h) => !h)} className={`grid place-items-center h-10 w-10 rounded-2xl shadow-card active:scale-95 ${showHistory ? "bg-brand-500 text-white" : "bg-white text-ink-soft"}`} aria-label="Historique">
                  <History className="h-5 w-5" />
                </button>
                <button onClick={onClose} className="grid place-items-center h-10 w-10 rounded-2xl bg-white shadow-card text-ink-soft active:scale-95"><X className="h-5 w-5" /></button>
              </div>
            </div>
          </div>

          {showHistory ? (
            <div className="px-5 pb-8 space-y-2.5">
              {history.length === 0 ? (
                <p className="text-sm text-ink-mute py-8 text-center">Aucun rapport enregistré pour l'instant.</p>
              ) : history.map((m) => (
                <div key={m.id} className="card p-3.5 flex items-center gap-3">
                  <span className="grid place-items-center h-11 w-11 rounded-2xl bg-brand-50 text-brand-700 shrink-0"><FileText className="h-5 w-5" /></span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-ink text-[14.5px]">{m.kind === "therapeute" ? "Thérapeute" : "Perso"} · {m.period} j</p>
                    <p className="text-[12px] text-ink-mute">{frDate(m.createdAt)}</p>
                  </div>
                  <button onClick={() => share(m)} className="grid place-items-center h-10 w-10 rounded-xl bg-brand-500 text-white active:scale-95" aria-label="Partager / Imprimer"><Share2 className="h-[18px] w-[18px]" /></button>
                  <button onClick={() => dl(m)} className="grid place-items-center h-10 w-10 rounded-xl bg-white text-ink-soft shadow-card active:scale-95" aria-label="Télécharger"><Download className="h-[18px] w-[18px]" /></button>
                  <button onClick={() => del(m)} className="grid place-items-center h-10 w-10 rounded-xl bg-white text-red-400 shadow-card active:scale-95" aria-label="Supprimer"><Trash2 className="h-[18px] w-[18px]" /></button>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 pb-8 space-y-6">
              <p className="text-[13.5px] text-ink-soft px-1">Un rapport PDF clinique détaillé — humeur, sommeil, traitements, symptômes — avec graphiques lisibles et synthèse IA. Enregistré dans l'app et téléchargeable.</p>

              <section>
                <p className="text-[11px] font-bold tracking-widest uppercase text-ink-mute mb-2 px-1">Période</p>
                <div className="grid grid-cols-3 gap-2">
                  {([7, 30, 90] as Period[]).map((p) => (
                    <button key={p} onClick={() => setPeriod(p)} className={`rounded-2xl py-3 font-display font-semibold transition active:scale-95 ${period === p ? "bg-brand-500 text-white shadow-glow" : "bg-white shadow-card text-ink-soft"}`}>
                      {p === 7 ? "7 jours" : p === 30 ? "30 jours" : "3 mois"}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <p className="text-[11px] font-bold tracking-widest uppercase text-ink-mute mb-2 px-1">Format</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setKind("therapeute")} className={`rounded-2xl p-4 text-left transition active:scale-[.98] ${kind === "therapeute" ? "bg-brand-500 text-white shadow-glow" : "bg-white shadow-card"}`}>
                    <UserRound className={`h-5 w-5 mb-1.5 ${kind === "therapeute" ? "text-white" : "text-brand-600"}`} />
                    <p className="font-bold text-[14px]">Thérapeute</p>
                    <p className={`text-[12px] ${kind === "therapeute" ? "text-white/80" : "text-ink-mute"}`}>Rapport clinique structuré</p>
                  </button>
                  <button onClick={() => setKind("perso")} className={`rounded-2xl p-4 text-left transition active:scale-[.98] ${kind === "perso" ? "bg-brand-500 text-white shadow-glow" : "bg-white shadow-card"}`}>
                    <HeartPulse className={`h-5 w-5 mb-1.5 ${kind === "perso" ? "text-white" : "text-brand-600"}`} />
                    <p className="font-bold text-[14px]">Perso</p>
                    <p className={`text-[12px] ${kind === "perso" ? "text-white/80" : "text-ink-mute"}`}>Bilan chaleureux pour toi</p>
                  </button>
                </div>
              </section>

              {step === "error" && <p className="text-sm text-red-500 px-1">Erreur : {err}</p>}
              {step === "done" && <p className="text-sm text-brand-700 font-semibold px-1 flex items-center gap-1.5"><Download className="h-4 w-4" /> Rapport généré, enregistré et téléchargé.</p>}

              <button onClick={generate} disabled={step === "working"} className="w-full rounded-3xl py-4 font-display text-[17px] font-semibold text-white flex items-center justify-center gap-2 bg-brand-500 shadow-glow disabled:opacity-60 active:scale-[.99]">
                {step === "working" ? <><Loader2 className="h-5 w-5 animate-spin" /> Génération…</> : <><Sparkles className="h-5 w-5" /> Générer le rapport PDF</>}
              </button>
              <p className="text-[12px] text-ink-mute text-center">Analyse IA : {aiUsesLeft()}/{AI_WEEKLY_MAX} restantes cette semaine</p>
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}

// ── PDF rendering ────────────────────────────────────────────────────────────
type RGB = [number, number, number];
async function makePdf(s: any, ai: string, kind: Kind, period: number, name?: string): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const PW = 210, PH = 297, M = 16, W = PW - M * 2;
  const GREEN: RGB = [26, 173, 85], DGREEN: RGB = [16, 110, 55], INK: RGB = [26, 38, 30];
  const GREY: RGB = [120, 130, 124], LIGHT: RGB = [237, 243, 238], AMBER: RGB = [200, 145, 47], RED: RGB = [208, 73, 44];
  let y = 0;
  const setC = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const setF = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const setD = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const moodColor = (v: number | null): RGB => v == null ? GREY : v >= 7 ? GREEN : v >= 5 ? AMBER : RED;
  const need = (h: number) => { if (y > PH - h) { doc.addPage(); y = 22; } };

  // — small vector icons (colored) —
  const icoHeart = (x: number, cy: number, c: RGB, sz = 3.4) => { setF(c); const r = sz / 3.4; doc.circle(x - 0.9 * r, cy - 0.5 * r, 1.05 * r, "F"); doc.circle(x + 0.9 * r, cy - 0.5 * r, 1.05 * r, "F"); doc.triangle(x - 2 * r, cy - 0.1 * r, x + 2 * r, cy - 0.1 * r, x, cy + 2 * r, "F"); };
  const icoPill = (x: number, cy: number, c: RGB) => { setF(c); doc.roundedRect(x - 2.2, cy - 1.1, 4.4, 2.2, 1.1, 1.1, "F"); setF([255, 255, 255]); doc.rect(x - 0.25, cy - 1.1, 0.5, 2.2, "F"); };
  const icoMoon = (x: number, cy: number, c: RGB, bg: RGB = [255, 255, 255]) => { setF(c); doc.circle(x, cy, 1.9, "F"); setF(bg); doc.circle(x + 1.1, cy - 0.5, 1.7, "F"); };
  const icoPulse = (x: number, cy: number, c: RGB) => { setD(c); doc.setLineWidth(0.5); doc.lines([[1, 0], [0.7, -1.8], [0.9, 3.2], [0.8, -1.6], [1, 0]], x - 2.2, cy); };
  const icoAlert = (x: number, cy: number, c: RGB) => { setF(c); doc.triangle(x - 2, cy + 1.6, x + 2, cy + 1.6, x, cy - 2, "F"); setF([255, 255, 255]); doc.rect(x - 0.3, cy - 0.6, 0.6, 1.3, "F"); doc.circle(x, cy + 1, 0.35, "F"); };
  const icoNote = (x: number, cy: number, c: RGB) => { setD(c); doc.setLineWidth(0.35); doc.roundedRect(x - 1.8, cy - 2.1, 3.6, 4.2, 0.5, 0.5, "S"); doc.line(x - 1, cy - 0.9, x + 1, cy - 0.9); doc.line(x - 1, cy + 0.1, x + 1, cy + 0.1); doc.line(x - 1, cy + 1.1, x + 0.3, cy + 1.1); };
  const icoUser = (x: number, cy: number, c: RGB) => { setF(c); doc.circle(x, cy - 1, 1.15, "F"); doc.roundedRect(x - 1.9, cy + 0.4, 3.8, 2, 1, 1, "F"); };

  const heading = (t: string, icon?: (x: number, cy: number, c: RGB) => void) => {
    need(14); y += 2;
    if (icon) icon(M + 2, y - 1.3, DGREEN);
    setF(GREEN); doc.roundedRect(icon ? M + 4.5 : M, y - 3.4, 2, 4.6, 1, 1, "F");
    setC(INK); doc.setFont("helvetica", "bold"); doc.setFontSize(12.5); doc.text(t, (icon ? M + 4.5 : M) + 4, y);
    y += 6.5;
  };
  const para = (t: string, size = 10, color: RGB = INK, x = M, width = W) => {
    setC(color); doc.setFont("helvetica", "normal"); doc.setFontSize(size);
    for (const l of doc.splitTextToSize(t, width)) { need(12); doc.text(l, x, y); y += size * 0.52 + 1.7; }
  };

  // ── HEADER ──
  setF(GREEN); doc.rect(0, 0, PW, 36, "F"); setF(DGREEN); doc.rect(0, 34, PW, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(24); doc.text("Moody", M, 16);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10.5);
  doc.text(kind === "therapeute" ? "Rapport clinique de suivi" : "Bilan de bien-être", M, 24);
  doc.setFontSize(8.5);
  doc.text(`${period} jours · ${shortDateLong(s.start)} → ${shortDateLong(s.end)}`, PW - M, 14, { align: "right" });
  doc.text(`Édité le ${new Date().toLocaleDateString("fr-FR")}`, PW - M, 20, { align: "right" });
  doc.text(`${s.daysLogged}/${period} jours renseignés · ${s.totalEntries} saisies`, PW - M, 26, { align: "right" });
  y = 44;

  // ── PATIENT BLOCK (therapist) ──
  const p = s.profile || {};
  if (kind === "therapeute" && (p.fullName || name || p.conditionsList?.length || p.allergies)) {
    const lines: string[] = [];
    const id = [p.fullName || name, s.age != null ? `${s.age} ans` : "", p.sex, p.bloodType ? `groupe ${p.bloodType}` : ""].filter(Boolean).join(" · ");
    if (id) lines.push(`Patient : ${id}`);
    if (p.conditionsList?.length) lines.push(`Pathologies : ${p.conditionsList.join(", ")}`);
    if (p.allergies) lines.push(`Allergies : ${p.allergies}`);
    if (s.medsFull?.length) lines.push(`Traitement en cours : ${s.medsFull.map((m: any) => `${m.name}${m.dose ? ` ${m.dose}` : ""}${m.times.length ? ` (${m.times.join(", ")})` : ""}`).join(" ; ")}`);
    const boxH = lines.length * 5 + 6;
    setF([246, 249, 246]); doc.roundedRect(M, y, W, boxH, 2.5, 2.5, "F");
    setF(GREEN); doc.roundedRect(M, y, 1.8, boxH, 0.9, 0.9, "F");
    icoUser(M + 6, y + 5.5, DGREEN);
    let yy = y + 5.5;
    lines.forEach((l, i) => {
      const [lab, ...rest] = l.split(" : ");
      setC(DGREEN); doc.setFont("helvetica", "bold"); doc.setFontSize(8.6); doc.text(lab.toUpperCase(), M + 11, yy);
      setC(INK); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      const val = doc.splitTextToSize(rest.join(" : "), W - 45);
      doc.text(val[0] ?? "", M + 44, yy);
      for (let k = 1; k < val.length; k++) { yy += 4.4; doc.text(val[k], M + 44, yy); }
      yy += 5; void i;
    });
    y += boxH + 8;
  }

  // ── KPI CARDS ──
  const trendArrow = s.moodDelta == null ? "" : s.moodDelta > 0 ? " +" + s.moodDelta : s.moodDelta < 0 ? " " + s.moodDelta : " =";
  const kpis: { label: string; value: string; sub?: string; color?: RGB }[] = [
    { label: "Humeur moy.", value: s.moodAvg != null ? `${s.moodAvg}/10` : "—", sub: `méd. ${s.moodMedian ?? "—"}${trendArrow}`, color: moodColor(s.moodAvg) },
    { label: "Amplitude", value: s.moodMin != null ? `${s.moodMin}–${s.moodMax}` : "—", sub: s.trend },
    { label: "Observance", value: s.adherence != null ? `${s.adherence}%` : "—", sub: s.adherence != null ? `${s.taken}/${s.scheduled}` : "n/a", color: s.adherence == null ? GREY : s.adherence >= 90 ? GREEN : s.adherence >= 70 ? AMBER : RED },
    { label: "Sommeil", value: s.sleepAvg != null ? `${s.sleepAvg} h` : "—", sub: s.sleepAvg != null ? `${s.sleepMin}–${s.sleepMax} h` : "auto-déclaré" },
  ];
  const gap = 4, cw = (W - gap * 3) / 4, ch = 24;
  kpis.forEach((k, i) => {
    const x = M + i * (cw + gap);
    setF(LIGHT); doc.roundedRect(x, y, cw, ch, 3, 3, "F");
    setC(k.color ?? DGREEN); doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text(k.value, x + cw / 2, y + 9.5, { align: "center" });
    setC(INK); doc.setFont("helvetica", "normal"); doc.setFontSize(7.6); doc.text(doc.splitTextToSize(k.sub ?? "", cw - 4)[0] ?? "", x + cw / 2, y + 15, { align: "center" });
    setC(GREY); doc.setFontSize(7); doc.text(k.label.toUpperCase(), x + cw / 2, y + 20.5, { align: "center" });
  });
  y += ch + 8;

  // ── MOOD CHART with axes ──
  heading("Évolution de l'humeur", icoHeart as any);
  const axW = 6, cX = M + axW, cY = y, cW = W - axW, cH = 42;
  setF([249, 251, 249]); doc.roundedRect(M, cY, W, cH, 2, 2, "F");
  // gridlines + Y labels (2,4,6,8,10)
  setD([224, 231, 226]); doc.setLineWidth(0.2);
  setC(GREY); doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
  [10, 8, 6, 4, 2].forEach((v) => {
    const gy = cY + 4 + (cH - 10) * (1 - (v - 1) / 9);
    doc.line(cX + 1, gy, cX + cW - 3, gy);
    doc.text(String(v), M + axW - 1.5, gy + 1, { align: "right" });
  });
  const ser = s.series as { date: string; value: number | null }[];
  const n = ser.length;
  const px = (i: number) => cX + 3 + (i * (cW - 8)) / Math.max(1, n - 1);
  const py = (v: number) => cY + 4 + (cH - 10) * (1 - (v - 1) / 9);
  const real = ser.map((d, i) => ({ ...d, i })).filter((d) => d.value != null) as { date: string; value: number; i: number }[];
  if (real.length) {
    // mean reference line
    if (s.moodAvg != null) { setD([170, 180, 174]); doc.setLineWidth(0.25); const my = py(s.moodAvg); dashed(doc, cX + 3, my, cX + cW - 5, my); setC(GREY); doc.setFontSize(6.2); doc.text(`moy ${s.moodAvg}`, cX + cW - 4, my - 0.8, { align: "right" }); }
    // line
    setD(GREEN); doc.setLineWidth(0.8);
    for (let k = 1; k < real.length; k++) doc.line(px(real[k - 1].i), py(real[k - 1].value), px(real[k].i), py(real[k].value));
    // dots colored by value
    real.forEach((d) => { setF(moodColor(d.value)); doc.circle(px(d.i), py(d.value), 0.9, "F"); });
    // best / worst markers
    const best = real.reduce((a, b) => (b.value > a.value ? b : a));
    const worst = real.reduce((a, b) => (b.value < a.value ? b : a));
    setF(GREEN); doc.circle(px(best.i), py(best.value), 1.4, "F"); setF([255, 255, 255]); doc.circle(px(best.i), py(best.value), 0.5, "F");
    setF(RED); doc.circle(px(worst.i), py(worst.value), 1.4, "F"); setF([255, 255, 255]); doc.circle(px(worst.i), py(worst.value), 0.5, "F");
    // X date labels
    setC(GREY); doc.setFont("helvetica", "normal"); doc.setFontSize(6.2);
    const ticks = [0, Math.floor((n - 1) / 3), Math.floor((2 * (n - 1)) / 3), n - 1].filter((v, idx, arr) => arr.indexOf(v) === idx);
    ticks.forEach((i) => doc.text(shortDate(ser[i].date), px(i), cY + cH - 1.5, { align: "center" }));
  } else { setC(GREY); doc.setFontSize(9); doc.text("Pas assez de données sur la période.", cX + cW / 2, cY + cH / 2, { align: "center" }); }
  y = cY + cH + 8;

  // ── MOOD DISTRIBUTION (histogram) ──
  if (s.totalEntries >= 3) {
    heading("Répartition des humeurs");
    const dist = s.dist as number[]; const maxD = Math.max(1, ...dist);
    const bw = (W - 9 * 2) / 10, bMaxH = 20;
    dist.forEach((count, i) => {
      const bx = M + i * (bw + 2), bh = (count / maxD) * bMaxH;
      setF([233, 238, 233]); doc.roundedRect(bx, y, bw, bMaxH, 1, 1, "F");
      if (bh > 0) { setF(moodColor(i + 1)); doc.roundedRect(bx, y + (bMaxH - bh), bw, bh, 1, 1, "F"); }
      setC(GREY); doc.setFont("helvetica", "normal"); doc.setFontSize(6.4); doc.text(String(i + 1), bx + bw / 2, y + bMaxH + 3.4, { align: "center" });
      if (count > 0) { setC(INK); doc.setFontSize(6.4); doc.text(String(count), bx + bw / 2, y + (bMaxH - bh) - 1, { align: "center" }); }
    });
    y += bMaxH + 8;
  }

  // ── INDICATORS TABLE ──
  need(50); heading("Indicateurs détaillés", icoPulse as any);
  const rows: [string, string][] = [
    ["Humeur — moyenne / médiane", `${s.moodAvg ?? "—"} / ${s.moodMedian ?? "—"} sur 10`],
    ["Humeur — min / max", `${s.moodMin ?? "—"} / ${s.moodMax ?? "—"}`],
    ["Tendance sur la période", s.trend + (s.moodDelta != null ? ` (${s.moodDelta >= 0 ? "+" : ""}${s.moodDelta} vs préc.)` : "")],
    ["Jours renseignés", `${s.daysLogged}/${period} (${Math.round((s.daysLogged / period) * 100)}%)`],
    ["Énergie moyenne", s.energyAvg != null ? `${s.energyAvg}/5${ENERGY_LABELS[Math.round(s.energyAvg) - 1] ? ` (${ENERGY_LABELS[Math.round(s.energyAvg) - 1]})` : ""}` : "—"],
    ["Appétit moyen", s.appetiteAvg != null ? `${s.appetiteAvg}/4${APPETITE_LABELS[Math.round(s.appetiteAvg) - 1] ? ` (${APPETITE_LABELS[Math.round(s.appetiteAvg) - 1]})` : ""}` : "—"],
    ["Sommeil moyen (déclaré)", s.sleepAvg != null ? `${s.sleepAvg} h/nuit (${s.sleepMin}–${s.sleepMax})` : "—"],
  ];
  if (s.health) rows.push(["Santé connectée (Apple Santé)", [s.health.sleepHours != null ? `sommeil ${s.health.sleepHours} h` : "", s.health.restingHR != null ? `FC repos ${s.health.restingHR} bpm` : "", s.health.steps != null ? `${s.health.steps} pas` : ""].filter(Boolean).join(" · ") || "—"]);
  rows.forEach((r, i) => {
    need(10);
    if (i % 2 === 0) { setF([246, 249, 246]); doc.rect(M, y - 4, W, 6.6, "F"); }
    setC(GREY); doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(r[0], M + 2, y);
    setC(INK); doc.setFont("helvetica", "bold"); const vl = doc.splitTextToSize(r[1], W * 0.5); doc.text(vl[0], PW - M - 2, y, { align: "right" });
    y += 6.6;
  });
  y += 4;

  // ── TREATMENTS ──
  need(30); heading("Traitements & observance", icoPill as any);
  if (s.adherence == null) para("Aucun traitement suivi sur la période.", 9.5, GREY);
  else {
    para(`Observance globale : ${s.adherence}% — ${s.taken}/${s.scheduled} prises respectées.`, 9.5, DGREEN);
    y += 1;
    const nameW = 52, barX = M + nameW + 2, barW = W - nameW - 34;
    s.perMed.forEach((m: any) => {
      need(9);
      const pct = Math.round((m.taken / m.sched) * 100);
      const col: RGB = pct >= 90 ? GREEN : pct >= 70 ? AMBER : RED;
      setC(INK); doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(doc.splitTextToSize(m.name, nameW)[0], M + 2, y);
      setF([230, 236, 231]); doc.roundedRect(barX, y - 2.6, barW, 3, 1.5, 1.5, "F");
      setF(col); doc.roundedRect(barX, y - 2.6, (barW * pct) / 100, 3, 1.5, 1.5, "F");
      setC(col); doc.setFont("helvetica", "bold"); doc.setFontSize(8.6); doc.text(`${pct}% (${m.taken}/${m.sched})`, PW - M - 2, y, { align: "right" });
      y += 7.5;
    });
  }
  y += 3;

  // ── SYMPTOM FREQUENCY ──
  if (s.symFreq.length) {
    need(24); heading("Symptômes — fréquence", icoAlert as any);
    const maxF = Math.max(...s.symFreq.map((x: any) => x[1]));
    s.symFreq.slice(0, 8).forEach(([sy, count]: any) => {
      need(8);
      setC(INK); doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(doc.splitTextToSize(sy, 55)[0], M + 2, y);
      const bx = M + 58, bw = W - 90;
      setF([243, 232, 226]); doc.roundedRect(bx, y - 2.4, bw, 2.8, 1.4, 1.4, "F");
      setF(AMBER); doc.roundedRect(bx, y - 2.4, (bw * count) / maxF, 2.8, 1.4, 1.4, "F");
      setC(INK); doc.setFont("helvetica", "bold"); doc.setFontSize(8.6); doc.text(`${count} jour${count > 1 ? "s" : ""}`, PW - M - 2, y, { align: "right" });
      y += 7;
    });
    y += 2;
  }

  // ── AI SYNTHESIS ──
  need(46);
  heading(kind === "therapeute" ? "Synthèse clinique" : "Ton bilan", icoNote as any);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.6);
  const aiLines = doc.splitTextToSize(ai || "—", W - 9);
  const boxTop = y - 4, boxH = aiLines.length * (9.6 * 0.52 + 1.7) + 6;
  setF([248, 250, 248]); doc.roundedRect(M, boxTop, W, boxH, 2.5, 2.5, "F");
  setF(GREEN); doc.roundedRect(M, boxTop, 1.6, boxH, 0.8, 0.8, "F");
  y += 2; para(ai || "—", 9.6, [50, 60, 54], M + 5, W - 9); y = boxTop + boxH + 8;

  // ── SYMPTOM TIMELINE ──
  if (s.symptomLog.length) {
    need(20); heading("Journal des symptômes", icoAlert as any);
    s.symptomLog.forEach((x: any) => para(`${shortDateLong(x.date)} — ${x.symptoms.join(", ")}${x.intensity ? ` (intensité ${["", "légère", "modérée", "forte"][x.intensity]})` : ""}${x.note ? ` · ${x.note}` : ""}`, 9, [80, 90, 84]));
    y += 3;
  }

  // ── ADVERSE EFFECTS ──
  if (s.sideEffects.length) {
    need(20); heading("Effets indésirables signalés", icoAlert as any);
    s.sideEffects.forEach((x: any) => para(`${shortDateLong(x.date)} — ${x.med} : ${x.text}`, 9, [80, 90, 84]));
    y += 3;
  }

  // ── NOTES ──
  if (s.notes.length) {
    need(20); heading("Notes personnelles", icoNote as any);
    s.notes.forEach((nt: any) => para(`${shortDateLong(nt.date)} — ${nt.note}`, 9, GREY));
  }

  // ── FOOTER ──
  const pages = doc.getNumberOfPages();
  for (let pg = 1; pg <= pages; pg++) {
    doc.setPage(pg);
    setD([230, 236, 231]); doc.setLineWidth(0.2); doc.line(M, PH - 12, PW - M, PH - 12);
    setC(GREY); doc.setFont("helvetica", "normal"); doc.setFontSize(7.2);
    doc.text("Généré par Moody · données auto-déclarées, ne constitue pas un diagnostic médical.", M, PH - 8);
    doc.text(`${pg}/${pages}`, PW - M, PH - 8, { align: "right" });
  }
  return doc.output("blob");
}

function shortDateLong(iso: string) { const d = new Date(iso + "T12:00:00"); return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" }); }
function dashed(doc: any, x1: number, y1: number, x2: number, y2: number) {
  const dash = 1.4, gap = 1.2, len = Math.hypot(x2 - x1, y2 - y1), steps = Math.floor(len / (dash + gap));
  for (let i = 0; i < steps; i++) { const a = (i * (dash + gap)) / len, b = (i * (dash + gap) + dash) / len; doc.line(x1 + (x2 - x1) * a, y1 + (y2 - y1) * a, x1 + (x2 - x1) * b, y1 + (y2 - y1) * b); }
}
