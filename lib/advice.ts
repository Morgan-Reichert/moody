import { aiNarrative } from "./ai";

export const COMMON_SYMPTOMS = [
  "Fièvre", "Fatigue", "Mal de tête", "Nausée", "Douleurs musculaires", "Toux",
  "Nez bouché / rhume", "Mal de gorge", "Vertiges", "Douleur abdominale", "Diarrhée",
  "Anxiété", "Insomnie", "Palpitations", "Éruption cutanée", "Perte d'appétit", "Frissons", "Essoufflement",
];

const RULES: { match: string[]; tip: string }[] = [
  { match: ["Fièvre", "Frissons"], tip: "Repose-toi, hydrate-toi bien et surveille ta température. Consulte si elle dépasse 39 °C ou dure plus de 3 jours." },
  { match: ["Toux", "Mal de gorge", "Nez bouché / rhume"], tip: "Repos, boissons chaudes et hydratation. Si la gêne respiratoire s'aggrave ou dure plus d'une semaine, vois un médecin." },
  { match: ["Mal de tête"], tip: "Bois de l'eau, repose tes yeux et évite les écrans un moment. Un mal de tête brutal et inhabituel doit amener à consulter." },
  { match: ["Nausée", "Douleur abdominale", "Diarrhée"], tip: "Hydrate-toi par petites gorgées, privilégie des aliments légers. Consulte si les douleurs sont fortes ou persistent au-delà de 48 h." },
  { match: ["Anxiété", "Palpitations"], tip: "Essaie une respiration lente (4 s inspire, 6 s expire). Si ça revient souvent, en parler à un professionnel aide vraiment." },
  { match: ["Insomnie", "Fatigue"], tip: "Vise des horaires réguliers, coupe les écrans avant le coucher. Une fatigue durable mérite un avis médical." },
  { match: ["Essoufflement"], tip: "Un essoufflement inhabituel au repos nécessite un avis médical rapide, surtout avec des palpitations." },
  { match: ["Éruption cutanée"], tip: "Évite de gratter, note l'évolution. Consulte si l'éruption s'étend vite ou s'accompagne de fièvre." },
];

export function localAdvice(symptoms: string[], intensity?: number): string {
  if (symptoms.length === 0) return "Prends soin de toi aujourd'hui. Repose-toi si besoin et écoute ton corps.";
  const tips = new Set<string>();
  for (const r of RULES) if (r.match.some((m) => symptoms.includes(m))) tips.add(r.tip);
  if (tips.size === 0) tips.add("Repose-toi, hydrate-toi et observe l'évolution.");
  const urgent = (intensity ?? 0) >= 3 ? " Vu l'intensité que tu décris, n'hésite pas à contacter un professionnel de santé." : "";
  return Array.from(tips).slice(0, 2).join(" ") + urgent;
}

/** Mix : tente un conseil affiné par IA, sinon repli local instantané. */
export async function getAdvice(symptoms: string[], intensity: number | undefined, note: string): Promise<string> {
  const local = localAdvice(symptoms, intensity);
  try {
    const sys = "Tu es un accompagnant bienveillant, pas un médecin. Donne en français 2-3 phrases de conseils de bon sens et rassurants face aux symptômes décrits, sans diagnostic ni prescription. Termine toujours par une invitation à consulter un professionnel si ça persiste ou s'aggrave.";
    const prompt = `Symptômes : ${symptoms.join(", ") || "aucun précisé"}. Intensité : ${["", "légère", "modérée", "forte"][intensity ?? 0] || "non précisée"}.${note ? ` Précisions : ${note}.` : ""}`;
    const ai = await aiNarrative(prompt, sys);
    return ai || local;
  } catch {
    return local;
  }
}
