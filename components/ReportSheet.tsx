"use client";

import { useEffect, useState } from "react";
import {
  getEntries, dosesForDate, isMedTaken, getSettings, dailySeries,
  ENERGY_LABELS, APPETITE_LABELS,
} from "@/lib/storage";
import { aiNarrative } from "@/lib/ai";
import { saveReport, listReports, getReportBlob, deleteReport, downloadBlob, shareBlob, ReportMeta } from "@/lib/reports-db";
import { Portal } from "@/components/Portal";
import { X, Sparkles, Loader2, Download, UserRound, HeartPulse, History, Trash2, FileText, Share2 } from "lucide-react";

type Period = 7 | 30 | 90;
type Kind = "perso" | "therapeute";
type Step = "idle" | "working" | "done" | "error";

function avg(a: number[]) { return a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : null; }
function frDate(ms: number) { return new Date(ms).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }

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
    const entries = getEntries().filter((e) => e.date >= start && e.date <= end);
    const moods = entries.map((e) => e.mood);
    const daysLogged = new Set(entries.map((e) => e.date)).size;
    const half = Math.floor(entries.length / 2);
    const tA = avg(entries.slice(half).map((e) => e.mood)), tB = avg(entries.slice(0, half).map((e) => e.mood));
    const trend = tA == null || tB == null ? "stable" : tA - tB > 0.5 ? "en amélioration" : tB - tA > 0.5 ? "en baisse" : "stable";

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
    return {
      start, end, series, entries, daysLogged, trend,
      moodAvg: avg(moods), moodMin: moods.length ? Math.min(...moods) : null, moodMax: moods.length ? Math.max(...moods) : null,
      energyAvg: avg(entries.map((e) => e.energy).filter((x): x is number => x != null)),
      appetiteAvg: avg(entries.map((e) => e.appetite).filter((x): x is number => x != null)),
      sleepAvg: avg(entries.map((e) => e.sleep).filter((x): x is number => x != null)),
      adherence: scheduled ? Math.round((taken / scheduled) * 100) : null,
      perMed: Object.values(perMed),
      notes: entries.filter((e) => e.note).slice(-8).map((e) => ({ date: e.date, note: e.note! })),
    };
  };

  const generate = async () => {
    setStep("working"); setErr("");
    try {
      const s = build();
      const name = getSettings().name;
      const facts = [
        `Période : ${s.start} au ${s.end} (${period} jours).`,
        `Jours renseignés : ${s.daysLogged}/${period}.`,
        `Humeur moyenne : ${s.moodAvg ?? "—"}/10 (min ${s.moodMin ?? "—"}, max ${s.moodMax ?? "—"}), tendance ${s.trend}.`,
        s.energyAvg != null ? `Énergie : ${ENERGY_LABELS[Math.round(s.energyAvg) - 1] ?? s.energyAvg} (${s.energyAvg}/5).` : "",
        s.appetiteAvg != null ? `Appétit : ${APPETITE_LABELS[Math.round(s.appetiteAvg) - 1] ?? s.appetiteAvg} (${s.appetiteAvg}/4).` : "",
        s.sleepAvg != null ? `Sommeil : ${s.sleepAvg} h/nuit.` : "",
        s.adherence != null ? `Observance : ${s.adherence}% (${s.perMed.map((m) => `${m.name} ${Math.round((m.taken / m.sched) * 100)}%`).join(", ")}).` : "Aucun traitement suivi.",
        s.notes.length ? `Notes : ${s.notes.map((n) => `${n.date} — ${n.note}`).join(" | ")}` : "",
      ].filter(Boolean).join("\n");

      const system = kind === "therapeute"
        ? "Tu es un assistant clinique. Rédige en français un résumé factuel à la 3e personne pour un professionnel de santé. Neutre, structuré, sans diagnostic ni conseil médical. 160-230 mots. N'invente aucune donnée."
        : "Tu es un accompagnant bienveillant. Rédige en français un bilan personnel chaleureux au tutoiement, sans jargon ni diagnostic. 150-220 mots.";
      let ai = "";
      try { ai = await aiNarrative(`Données de suivi${name ? ` de ${name}` : ""} :\n${facts}\n\nRédige l'analyse.`, system); }
      catch { ai = "(Analyse IA indisponible — le rapport chiffré ci-dessous reste complet.)"; }

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
              <p className="text-[13.5px] text-ink-soft px-1">Un rapport PDF soigné de ton humeur et de tes traitements, avec analyse IA. Enregistré dans l'app et téléchargeable.</p>

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
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}

// ── PDF rendering ────────────────────────────────────────────────────────────
async function makePdf(s: any, ai: string, kind: Kind, period: number, name?: string): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const PW = 210, PH = 297, M = 16, W = PW - M * 2;
  const GREEN: [number, number, number] = [26, 173, 85];
  const DGREEN: [number, number, number] = [16, 110, 55];
  const INK: [number, number, number] = [26, 38, 30];
  const GREY: [number, number, number] = [120, 130, 124];
  const LIGHT: [number, number, number] = [237, 243, 238];
  let y = 0;

  const setC = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const setF = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);

  // ── header band ──
  setF(GREEN); doc.rect(0, 0, PW, 34, "F");
  setF(DGREEN); doc.rect(0, 32, PW, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(24); doc.text("Moody", M, 16);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10.5);
  doc.text(kind === "therapeute" ? "Rapport clinique de suivi" : "Bilan de bien-être", M, 24);
  doc.setFontSize(9);
  const meta = `${period} jours · ${s.start} → ${s.end}`;
  doc.text(meta, PW - M, 16, { align: "right" });
  doc.text(`Édité le ${new Date().toLocaleDateString("fr-FR")}`, PW - M, 22, { align: "right" });
  if (name) doc.text(`Suivi : ${name}`, PW - M, 28, { align: "right" });
  y = 44;

  // ── KPI cards ──
  const kpis = [
    { label: "Humeur moy.", value: s.moodAvg != null ? `${s.moodAvg}/10` : "—" },
    { label: "Jours suivis", value: `${s.daysLogged}/${period}` },
    { label: "Observance", value: s.adherence != null ? `${s.adherence}%` : "—" },
    { label: "Sommeil", value: s.sleepAvg != null ? `${s.sleepAvg} h` : "—" },
  ];
  const gap = 4, cw = (W - gap * 3) / 4, ch = 22;
  kpis.forEach((k, i) => {
    const x = M + i * (cw + gap);
    setF(LIGHT); doc.roundedRect(x, y, cw, ch, 3, 3, "F");
    setC(DGREEN); doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text(k.value, x + cw / 2, y + 10, { align: "center" });
    setC(GREY); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.text(k.label.toUpperCase(), x + cw / 2, y + 16, { align: "center" });
  });
  y += ch + 10;

  const heading = (t: string) => {
    setF(GREEN); doc.roundedRect(M, y - 3.5, 2.2, 5, 1, 1, "F");
    setC(INK); doc.setFont("helvetica", "bold"); doc.setFontSize(12.5); doc.text(t, M + 5, y);
    y += 6;
  };
  const para = (t: string, size = 10, color = INK) => {
    setC(color); doc.setFont("helvetica", "normal"); doc.setFontSize(size);
    for (const l of doc.splitTextToSize(t, W)) { if (y > PH - 20) { doc.addPage(); y = 20; } doc.text(l, M, y); y += size * 0.52 + 1.6; }
  };

  // ── mood chart ──
  heading("Évolution de l'humeur");
  const cx = M, cy = y, cW = W, cH = 34;
  setF([248, 250, 248]); doc.roundedRect(cx, cy, cW, cH, 2, 2, "F");
  doc.setDrawColor(225, 232, 227); doc.setLineWidth(0.2);
  for (let g = 0; g <= 2; g++) { const gy = cy + 4 + (g * (cH - 8)) / 2; doc.line(cx + 3, gy, cx + cW - 3, gy); }
  const pts = s.series.filter((p: any) => p.value != null);
  if (pts.length) {
    const n = s.series.length;
    const px = (i: number) => cx + 4 + (i * (cW - 8)) / Math.max(1, n - 1);
    const py = (v: number) => cy + 4 + (cH - 8) * (1 - (v - 1) / 9);
    doc.setDrawColor(GREEN[0], GREEN[1], GREEN[2]); doc.setLineWidth(0.8);
    let prev: [number, number] | null = null;
    s.series.forEach((p: any, i: number) => {
      if (p.value == null) return;
      const X = px(i), Y = py(p.value);
      if (prev) doc.line(prev[0], prev[1], X, Y);
      prev = [X, Y];
    });
    setF(DGREEN);
    s.series.forEach((p: any, i: number) => { if (p.value != null) doc.circle(px(i), py(p.value), 0.7, "F"); });
  } else { setC(GREY); doc.setFontSize(9); doc.text("Pas assez de données sur la période.", cx + cW / 2, cy + cH / 2, { align: "center" }); }
  y = cy + cH + 9;

  // ── indicators table ──
  heading("Indicateurs");
  const rows: [string, string][] = [
    ["Humeur (moy. / min / max)", `${s.moodAvg ?? "—"} / ${s.moodMin ?? "—"} / ${s.moodMax ?? "—"}`],
    ["Tendance", s.trend],
    ["Énergie moyenne", s.energyAvg != null ? `${s.energyAvg}/5` : "—"],
    ["Appétit moyen", s.appetiteAvg != null ? `${s.appetiteAvg}/4` : "—"],
    ["Sommeil moyen", s.sleepAvg != null ? `${s.sleepAvg} h/nuit` : "—"],
  ];
  rows.forEach((r, i) => {
    if (i % 2 === 0) { setF([246, 249, 246]); doc.rect(M, y - 4, W, 7, "F"); }
    setC(GREY); doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.text(r[0], M + 2, y);
    setC(INK); doc.setFont("helvetica", "bold"); doc.text(r[1], PW - M - 2, y, { align: "right" });
    y += 7;
  });
  y += 5;

  // ── treatments ──
  heading("Traitements");
  if (s.adherence == null) para("Aucun traitement suivi sur la période.");
  else {
    para(`Observance globale : ${s.adherence}%`, 10, DGREEN);
    s.perMed.forEach((m: any) => {
      const pct = Math.round((m.taken / m.sched) * 100);
      setC(INK); doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.text(`${m.name}`, M + 2, y);
      // bar
      const bx = M + 60, bw = W - 90;
      setF([230, 236, 231]); doc.roundedRect(bx, y - 3, bw, 3, 1.5, 1.5, "F");
      setF(GREEN); doc.roundedRect(bx, y - 3, (bw * pct) / 100, 3, 1.5, 1.5, "F");
      setC(INK); doc.setFont("helvetica", "bold"); doc.text(`${pct}% (${m.taken}/${m.sched})`, PW - M - 2, y, { align: "right" });
      y += 8;
    });
  }
  y += 4;

  // ── AI analysis ──
  if (y > PH - 50) { doc.addPage(); y = 20; }
  heading(kind === "therapeute" ? "Synthèse clinique" : "Ton bilan");
  const boxTop = y - 4;
  const aiLines = doc.splitTextToSize(ai || "—", W - 8);
  const boxH = aiLines.length * (10 * 0.52 + 1.6) + 6;
  setF([248, 250, 248]); doc.roundedRect(M, boxTop, W, boxH, 2, 2, "F");
  setF(GREEN); doc.roundedRect(M, boxTop, 1.6, boxH, 0.8, 0.8, "F");
  y += 2; para(ai || "—", 10, [55, 65, 58]); y = boxTop + boxH + 8;

  // ── notes ──
  if (s.notes.length) {
    if (y > PH - 40) { doc.addPage(); y = 20; }
    heading("Notes");
    s.notes.forEach((nt: any) => para(`${nt.date} — ${nt.note}`, 9, GREY));
  }

  // ── footer on every page ──
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(230, 236, 231); doc.setLineWidth(0.2); doc.line(M, PH - 12, PW - M, PH - 12);
    setC(GREY); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
    doc.text("Généré par Moody · données auto-déclarées, ne constitue pas un diagnostic médical.", M, PH - 8);
    doc.text(`${p}/${pages}`, PW - M, PH - 8, { align: "right" });
  }

  return doc.output("blob");
}
