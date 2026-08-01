<div align="center">

<img src="./public/icon-192.png" width="88" height="88" alt="Moody" style="border-radius:22px" />

# Moody

**Suivi de l'humeur & des traitements, en douceur.**

![Next.js](https://img.shields.io/badge/Next.js_14-black?style=flat-square&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-installable-1aad55?style=flat-square&logo=pwa&logoColor=white)
![Privé](https://img.shields.io/badge/100%25-local-16211b?style=flat-square)

</div>

---

## Présentation

**Moody** est une PWA minimaliste pour noter son humeur au quotidien et suivre la prise de ses médicaments, avec des **rappels** aux heures choisies. Tout est stocké **localement** sur l'appareil — aucun compte, aucun serveur, aucune donnée qui sort du téléphone.

L'app tient en **deux écrans**, navigables au doigt (swipe) :

- **Accueil** — humeur du jour, moyenne 7 jours, série, prochains rappels, courbe sur 14 jours.
- **Humeur** — saisie rapide : niveau 1–10, énergie, appétit, sommeil, médicaments cochés, note.

## Rappels & alarme

- Horaires de rappel configurables pour l'humeur et pour chaque médicament.
- **Alarme forte** optionnelle (sonnerie longue en boucle) pour les médicaments.
- **Scan pour couper** optionnel : l'alarme ne s'arrête qu'en scannant le code-barres du médicament à la caméra (`BarcodeDetector`).
- Relance automatique après un délai si le rappel n'est pas validé.
- Notifications système (bip court) quand l'app tourne en arrière-plan.

> ⚠️ Limite web : une PWA ne peut pas jouer une sonnerie forte lorsqu'elle est **complètement fermée** (surtout sur iOS). L'alarme forte fonctionne quand l'app est ouverte/active ; app fermée, on ne peut compter que sur une notification système. Une vraie alarme « réveil » nécessiterait une app native.

## Stack

- **Next.js 14** (App Router, export statique) · **TypeScript**
- **Tailwind CSS** — thème vert Moody, cartes pastel, coins arrondis
- **Recharts** (courbe d'humeur) · **lucide-react** (icônes)
- **Fonts** : Fredoka (titres) + Nunito (texte)
- **Stockage** : `localStorage` uniquement

## Développement

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # export statique dans ./out
```

## Apps natives iOS & Android (Capacitor)

Le même code tourne en **app native** via [Capacitor](https://capacitorjs.com). Les projets natifs sont dans `ios/` et `android/`.

**Notifications natives** : sur mobile, les rappels d'humeur, de médicaments et de rendez-vous sont programmés au niveau de l'OS (`@capacitor/local-notifications`) — ils sonnent **même app fermée**. Sur le web, le moteur in-app prend le relais.

Prérequis : **Xcode** (iOS) + **CocoaPods** (`sudo gem install cocoapods`), **Android Studio** + **JDK 17** (Android).

```bash
# Android
npm run android        # build + sync + ouvre Android Studio → Run

# iOS (sur Mac)
cd ios/App && pod install && cd ../..
npm run ios            # build + sync + ouvre Xcode → Run (signer avec ton équipe Apple)

# Après chaque changement de code web :
npm run cap:sync
```

Config : `capacitor.config.ts` (`appId: tech.stariax.moody`, `webDir: out`).

**Icônes & splash** : sources dans `assets/` (`icon.png`, `splash.png`, `splash-dark.png`). Régénérer avec `npx @capacitor/assets generate`.

**Alarme forte des médicaments** : le son `alarm.wav` (26 s) est dans `android/app/src/main/res/raw/` (auto-inclus) et `ios/App/App/`. ⚠️ Sur **iOS**, il faut l'ajouter au bundle : dans Xcode, glisser `alarm.wav` dans le projet App et cocher la target « App » (Copy Bundle Resources). Quand « Alarme forte » est activée, les notifs médicaments utilisent ce son ; taper la notif ouvre l'alarme in-app avec **scan du médicament pour la couper**.

<div align="center"><sub>Groupe Stariax · 100% privé, local-first.</sub></div>
