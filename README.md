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

<div align="center"><sub>Groupe Stariax · 100% privé, local-first.</sub></div>
