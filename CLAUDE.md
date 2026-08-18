# Moody — Project Guide for Claude

## Overview

**Moody** is a Next.js 14 PWA for daily **mood tracking** and **medication reminders**. It is intentionally tiny — **two swipeable screens** (Accueil / Humeur), French UI, fully **local-first** (localStorage only, no auth, no backend, no analytics).

> History: this repo was previously "MindScope" (a mental-health self-assessment app with tests, an educational library, and a local LLM). The full app is archived on the `archive/v1-full` branch and the `v1.0-full-app` tag. `main` was reduced to Moody.

## App iOS native (depuis août 2026)

**L'app iPhone est désormais 100 % SwiftUI** : tout vit dans `ios/App/App/AppDelegate.swift`
(design pastel, saisie humeur complète, médicaments + notifications natives, alarme forte,
Swift Charts, rapport + partage QR médecin via Supabase, accueil modulable, migration
automatique du localStorage WebKit de l'ancienne version Capacitor).
Bundle `tech.stariax.moodyapp`, équipe `CU75SN7LD9`. Build :
`xcodebuild -workspace ios/App/App.xcworkspace -scheme App -destination 'generic/platform=iOS' build`
(toujours le **workspace**, jamais le .xcodeproj). La version web Next.js reste la référence
du modèle de données (clés `moody_*`) et sert le site + la page `/consult` du QR médecin.

## Tech stack

- **Next.js 14** App Router, `output: 'export'` (static), `trailingSlash: true`
- **TypeScript** (strict) · **Tailwind CSS** (single light theme, `color-scheme: light`)
- **Recharts** (mood curve) · **lucide-react** (all icons — no emoji in UI)
- **Fonts** via `next/font/google`: Fredoka (`--font-display`) + Nunito (`--font-body`)
- Storage: `localStorage` only

## Structure

```
app/
  layout.tsx        — fonts, PWA metadata, SW registration
  page.tsx          — app shell: transform-based swipe slider (Dashboard <-> MoodScreen) + BottomNav + ReminderEngine
  globals.css       — PWA rules (no overscroll, safe-area, hidden scrollbars), tokens
components/
  Dashboard.tsx     — Accueil: mood-of-day ring, stats, next reminders, 14-day chart
  MoodScreen.tsx    — Humeur entry: 1–10 scale, energy/appetite, sleep, meds checklist, note
  MoodChart.tsx     — recharts area chart (client-only)
  BottomNav.tsx     — floating dark pill nav (Accueil / + / Humeur)
  RemindersSettings.tsx — bottom sheet: mood times, meds (+ times + barcode), alarm toggles, notifications
  ReminderEngine.tsx    — scheduler loop + alarm overlay (soft chime / loud siren), snooze/re-alert
  BarcodeScanner.tsx    — camera + BarcodeDetector (register a code / scan-to-dismiss)
  Portal.tsx        — createPortal to body (fixed overlays must escape the transformed swipe track)
lib/
  storage.ts        — data layer: MoodEntry, Medication, ReminderSettings + reactive onChange(); migrates old mindscope_* keys
  reminders.ts      — dueReminders(), nextReminders(), Notification helpers, Alarm (WebAudio) class
public/
  manifest.json, sw.js, icon-192/512/maskable/apple-touch/favicon.png, brand/ (wordmark + icon)
```

## Design system

- Brand green from the logo. Tailwind tokens: `brand.*`, `ink`/`ink-soft`/`ink-mute`, `cream` (bg), pastel tints `mint/peach/lilac/butter`.
- Rounded cards (`rounded-3xl/4xl`), soft shadows (`shadow-card/soft/pill/glow`).
- **No emojis in UI** — use lucide-react icons only.
- Single light theme by deliberate choice (calming daytime wellness app).

## Key constraints & gotchas

- **Swipe slider uses `transform: translate3d`** → any `position: fixed` overlay rendered inside a screen MUST be wrapped in `<Portal>` or it anchors to the transformed track, not the viewport.
- **Reminders only fire while the app is running** (foreground or a live background tab). Web PWAs cannot fire a loud, unclosable alarm when fully closed — especially iOS. A true wake-alarm would need a native app or a push server.
- Static export: reference assets with **relative** paths (`./brand/...`, `./manifest.json`) so it works under any base path (Vercel root or a subpath).
- Deployment: Vercel auto-deploys `main`. (`.github/workflows/deploy.yml` is a legacy GitHub Pages workflow.)

## Commands

```bash
npm install
npm run dev
npm run build     # → ./out
```
