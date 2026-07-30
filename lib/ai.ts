// Lightweight AI narrative for medical reports (Mistral API, client-side).
// Note: this key ships in the client (as in the previous version). Rotate it if the repo becomes public.
const MISTRAL_KEY = "2LitVaCxXcwT2RYBz63xKEoPxGHcgAKJ";
const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";

// ── weekly usage quota (avoid overruns) ──────────────────────────────────────
export const AI_WEEKLY_MAX = 4;
const K_AI = "moody_ai_uses";
const WINDOW = 7 * 24 * 60 * 60 * 1000;

function reads(): number[] {
  if (typeof window === "undefined") return [];
  try { return (JSON.parse(localStorage.getItem(K_AI) || "[]") as number[]); } catch { return []; }
}
function recent(): number[] { const now = Date.now(); return reads().filter((t) => now - t < WINDOW); }
export function aiUsesLeft(): number { return Math.max(0, AI_WEEKLY_MAX - recent().length); }
export function aiQuotaResetAt(): number | null { const r = recent(); return r.length ? Math.min(...r) + WINDOW : null; }
function record(): void {
  if (typeof window === "undefined") return;
  const arr = recent(); arr.push(Date.now());
  try { localStorage.setItem(K_AI, JSON.stringify(arr)); } catch { /* */ }
}

export class AIQuotaError extends Error { constructor() { super("quota"); this.name = "AIQuotaError"; } }

export async function aiNarrative(prompt: string, system: string): Promise<string> {
  if (aiUsesLeft() <= 0) throw new AIQuotaError();
  const res = await fetch(MISTRAL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${MISTRAL_KEY}` },
    body: JSON.stringify({
      model: "mistral-small-latest",
      temperature: 0.4,
      max_tokens: 900,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Mistral ${res.status}`);
  const data = await res.json();
  record(); // count only successful calls
  return (data?.choices?.[0]?.message?.content ?? "").trim();
}
