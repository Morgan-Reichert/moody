// Gentle daily wellbeing tips — a daytime set and an evening/bedtime set.
// Deterministic by day so the tip is stable within a day and rotates over time.

const DAY_TIPS = [
  "Bois un verre d'eau, là, maintenant.",
  "Sors prendre l'air 10 minutes, même court.",
  "Étire-toi doucement pendant 2 minutes.",
  "Fais une vraie pause, loin des écrans.",
  "Un peu de marche suffit à remonter l'humeur.",
  "Écris une chose pour laquelle tu es reconnaissant·e.",
  "Respire profondément 3 fois, épaules relâchées.",
  "Contacte quelqu'un qui te fait du bien.",
  "Range un petit coin : l'esprit s'apaise aussi.",
  "Mange quelque chose de nourrissant à ton prochain repas.",
  "Accorde-toi 5 minutes rien que pour toi.",
  "Note ton humeur : suivre, c'est déjà prendre soin.",
  "Mets une musique qui te fait du bien.",
  "Sois aussi doux·ce avec toi qu'avec un ami.",
  "Une petite victoire compte. Reconnais-la.",
];

const EVENING_TIPS = [
  "Il se fait tard : baisse un peu les lumières.",
  "Pose ton téléphone 30 min avant de dormir.",
  "Une tisane sans théine aide à trouver le sommeil.",
  "Note 3 choses positives de ta journée.",
  "Respire en 4-7-8 pour apaiser ton corps.",
  "Évite les écrans au lit, ta tête te remerciera.",
  "Garde ta chambre fraîche et sombre.",
  "Vise une heure de coucher régulière, même le week-end.",
  "Écris ce qui te tracasse pour vider ta tête.",
  "Étire-toi doucement avant de te glisser au lit.",
  "Coupe les notifications pour la nuit.",
  "Un dernier verre d'eau, puis au calme.",
  "Demain est un autre jour. Repose-toi.",
  "Ferme les yeux, relâche la mâchoire et les épaules.",
];

export interface DailyTip { text: string; evening: boolean }

export function isEvening(now = new Date()): boolean {
  const h = now.getHours();
  return h >= 20 || h < 5;
}

/** The tip for the current moment (bedtime tips in the evening, otherwise daytime). */
export function tipOfDay(now = new Date()): DailyTip {
  const evening = isEvening(now);
  const list = evening ? EVENING_TIPS : DAY_TIPS;
  const dayNum = Math.floor(now.getTime() / 864e5);
  return { text: list[Math.abs(dayNum) % list.length], evening };
}

/** A random evening tip (used inside the bedtime notification). */
export function randomEveningTip(seed = new Date()): string {
  const dayNum = Math.floor(seed.getTime() / 864e5);
  return EVENING_TIPS[Math.abs(dayNum) % EVENING_TIPS.length];
}
