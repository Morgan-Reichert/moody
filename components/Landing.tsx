"use client";

import { useState } from "react";
import {
  Smile, Pill, HeartPulse, QrCode, Wind, Lock, Sparkles, Droplet, Droplets,
  Heart, Lightbulb, Sun, ShieldCheck, Check, ArrowRight,
  Share, Plus, MoreVertical,
} from "lucide-react";

const FEATURES = [
  { icon: Smile, tint: "bg-mint", color: "#128a43", title: "Suivi de l'humeur", desc: "Note ton moral en 10 s, vois tes tendances sur 14 jours et un rapport clair." },
  { icon: Pill, tint: "bg-peach", color: "#c8622f", title: "Médicaments & rappels", desc: "Horaires par jour, alarme forte, et notifications même app fermée." },
  { icon: HeartPulse, tint: "bg-lilac", color: "#6b4fb0", title: "Espace santé", desc: "Ta fiche, tes médecins, tes ordonnances et rendez-vous, au même endroit." },
  { icon: QrCode, tint: "bg-mint", color: "#128a43", title: "Partage médecin par QR", desc: "Un lien à usage unique pour transmettre ta fiche à un soignant, en sécurité." },
  { icon: Lightbulb, tint: "bg-butter", color: "#a9821f", title: "Corrélations d'humeur", desc: "Découvre ce qui influence ton moral : sommeil, sport, hydratation…" },
  { icon: Lock, tint: "bg-lilac", color: "#6b4fb0", title: "100% privé", desc: "Tout reste sur ton téléphone. Face ID en option. Aucune donnée revendue." },
];

const MODULES = [
  { icon: Droplets, label: "Hydratation" }, { icon: Sparkles, label: "Brossage" },
  { icon: Droplet, label: "Règles" }, { icon: Heart, label: "Vie sexuelle" },
  { icon: Sun, label: "Gratitude" }, { icon: ShieldCheck, label: "Addictions" },
  { icon: Check, label: "Observance" }, { icon: Wind, label: "Respiration" },
];

export function Landing({ onEnter }: { onEnter: () => void }) {
  const [tab, setTab] = useState<"ios" | "android">(typeof navigator !== "undefined" && /android/i.test(navigator.userAgent) ? "android" : "ios");

  return (
    <div className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-cream text-ink">
      {/* soft ambient blobs */}
      <div className="pointer-events-none absolute -top-24 right-0 h-72 w-72 md:h-[28rem] md:w-[28rem] rounded-full bg-brand-200/40 blur-3xl" />
      <div className="pointer-events-none absolute top-96 left-0 h-72 w-72 md:h-[28rem] md:w-[28rem] rounded-full bg-lilac/60 blur-3xl" />

      <div className="relative mx-auto w-full max-w-md md:max-w-5xl px-6 md:px-10 pt-safe pb-16 md:pb-24">
        {/* ── Hero ── */}
        <header className="pt-10 md:pt-16 text-center animate-rise md:max-w-2xl md:mx-auto">
          <img src="/brand/moody-icon.png" alt="" className="mx-auto h-20 w-20 md:h-24 md:w-24 rounded-[22px] md:rounded-[28px] shadow-soft" />
          <img src="/brand/moody-wordmark-tight.png" alt="Moody" className="mx-auto mt-4 h-12 md:h-16 w-auto" />

          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/70 border border-white px-3 py-1 text-[12px] md:text-[13px] font-bold text-brand-700 shadow-card">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75 animate-ping" /><span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" /></span>
            En développement actif
          </div>

          <h1 className="mt-5 font-display text-[30px] md:text-[46px] leading-[1.1] font-semibold text-ink">
            Ton compagnon doux pour l'humeur, les traitements et le bien-être.
          </h1>
          <p className="mt-3 md:mt-4 text-[15px] md:text-[18px] text-ink-soft leading-relaxed">
            Suis ton moral, tes médicaments et ta santé — simplement, en privé, au quotidien.
          </p>

          <div className="mt-7 flex flex-col sm:flex-row sm:justify-center gap-3">
            <button onClick={onEnter} className="flex items-center justify-center gap-2 rounded-2xl py-4 sm:px-8 bg-brand-500 text-white font-bold shadow-glow active:scale-[.98] transition">
              Essayer la beta <ArrowRight className="h-5 w-5" />
            </button>
            <a href="#installer" className="flex items-center justify-center gap-2 rounded-2xl py-4 sm:px-8 bg-white text-ink font-bold shadow-card active:scale-[.98] transition">
              Installer sur mon téléphone
            </a>
          </div>
          <p className="mt-3 text-[12.5px] md:text-[13.5px] text-ink-mute flex items-center justify-center gap-1.5">
            <Lock className="h-3.5 w-3.5" /> Gratuit · sans compte · 100% sur ton appareil
          </p>
        </header>

        {/* ── Features ── */}
        <section className="mt-14 md:mt-24">
          <h2 className="font-display text-[22px] md:text-[30px] font-semibold text-center mb-6 md:mb-10">Tout Moody, en un endroit</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3.5 rounded-3xl bg-white p-4 md:p-5 shadow-card md:flex-col md:items-start">
                <span className={`grid place-items-center h-12 w-12 md:h-14 md:w-14 rounded-2xl shrink-0 ${f.tint}`} style={{ color: f.color }}>
                  <f.icon className="h-6 w-6 md:h-7 md:w-7" />
                </span>
                <div className="min-w-0 md:mt-2">
                  <h3 className="font-bold text-ink text-[15.5px] md:text-[17px]">{f.title}</h3>
                  <p className="text-[13.5px] md:text-[14.5px] text-ink-soft leading-snug mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Optional trackers ── */}
        <section className="mt-12 md:mt-20 rounded-4xl bg-white p-5 md:p-8 shadow-card md:max-w-3xl md:mx-auto">
          <h2 className="font-display text-[18px] md:text-[24px] font-semibold text-center">Des suivis à la carte</h2>
          <p className="text-[13px] md:text-[15px] text-ink-mute text-center mt-1 mb-4 md:mb-6">Active seulement ce qui t'est utile.</p>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2.5 md:gap-3">
            {MODULES.map((m) => (
              <div key={m.label} className="flex flex-col items-center gap-1.5 rounded-2xl bg-cream py-3 md:py-4">
                <m.icon className="h-5 w-5 md:h-6 md:w-6 text-brand-600" />
                <span className="text-[10.5px] md:text-[11.5px] font-semibold text-ink-soft text-center leading-tight">{m.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Active development note ── */}
        <section className="mt-6 md:mt-8 rounded-4xl bg-lilac p-6 md:p-10 shadow-soft text-center md:max-w-3xl md:mx-auto">
          <Sparkles className="h-7 w-7 md:h-9 md:w-9 mx-auto text-brand-600" />
          <h2 className="font-display text-[18px] md:text-[24px] font-semibold mt-2">Encore en construction</h2>
          <p className="text-[13.5px] md:text-[15.5px] text-ink-soft leading-relaxed mt-2 md:max-w-xl md:mx-auto">
            Moody évolue chaque semaine : de nouveaux suivis, une version iOS native et des widgets arrivent.
            Ton retour façonne le produit.
          </p>
          <a href="https://stariax.tech/help" target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] md:text-[15px] font-bold text-brand-700">
            Partager une idée ou un bug <ArrowRight className="h-4 w-4" />
          </a>
        </section>

        {/* ── Install (PWA) ── */}
        <section id="installer" className="mt-12 md:mt-20 scroll-mt-6 md:max-w-2xl md:mx-auto">
          <h2 className="font-display text-[22px] md:text-[30px] font-semibold text-center mb-2">Installe-la comme une vraie app</h2>
          <p className="text-[13.5px] md:text-[16px] text-ink-soft text-center mb-5 md:mb-7">Ajoute Moody à ton écran d'accueil pour la lancer en plein écran, avec les notifications.</p>

          <div className="flex gap-2 bg-white rounded-2xl p-1 shadow-card mb-4 max-w-xs mx-auto">
            {([["ios", "iPhone"], ["android", "Android"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} className={`flex-1 rounded-xl py-2 text-[13px] font-bold transition ${tab === k ? "bg-brand-500 text-white shadow-glow" : "text-ink-mute"}`}>{label}</button>
            ))}
          </div>

          <div className="rounded-3xl bg-white p-5 md:p-7 shadow-card space-y-3 md:space-y-4">
            {(tab === "ios"
              ? [[<Share key="s" className="h-4 w-4" />, "Ouvre la beta dans Safari, puis touche le bouton Partager"],
                 [<Plus key="p" className="h-4 w-4" />, "Choisis « Sur l'écran d'accueil »"],
                 [<Check key="c" className="h-4 w-4" />, "Touche « Ajouter » — Moody apparaît sur ton écran"]]
              : [[<MoreVertical key="m" className="h-4 w-4" />, "Ouvre la beta dans Chrome, puis le menu ⋮"],
                 [<Plus key="p" className="h-4 w-4" />, "Choisis « Ajouter à l'écran d'accueil » / « Installer »"],
                 [<Check key="c" className="h-4 w-4" />, "Confirme — Moody s'installe comme une app"]]
            ).map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="grid place-items-center h-8 w-8 rounded-xl bg-brand-50 text-brand-700 shrink-0 font-bold text-sm">{i + 1}</span>
                <span className="flex items-center gap-2 text-[13.5px] md:text-[15px] text-ink-soft">{step[0]}<span>{step[1]}</span></span>
              </div>
            ))}
          </div>

          <button onClick={onEnter} className="mt-4 md:mt-6 w-full md:w-auto md:px-10 md:mx-auto flex items-center justify-center gap-2 rounded-2xl py-4 bg-brand-500 text-white font-bold shadow-glow active:scale-[.98] transition">
            Ouvrir la beta maintenant <ArrowRight className="h-5 w-5" />
          </button>
        </section>

        {/* ── Footer ── */}
        <footer className="mt-14 md:mt-24 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[12.5px] md:text-[13.5px] text-ink-mute">
            <span>Édité par</span>
            <img src="/brand/stariax-wordmark.png" alt="Stariax" className="h-3.5 md:h-4 w-auto opacity-70" />
          </div>
          <p className="mt-2 text-[11.5px] md:text-[12.5px] text-ink-mute/80">Moody — beta · fait avec <Heart className="inline h-3 w-3 fill-brand-400 text-brand-400" /></p>
        </footer>
      </div>
    </div>
  );
}
