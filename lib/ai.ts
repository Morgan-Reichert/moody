// Lightweight AI narrative for medical reports (Mistral API, client-side).
// Note: this key ships in the client (as in the previous version). Rotate it if the repo becomes public.
const MISTRAL_KEY = "2LitVaCxXcwT2RYBz63xKEoPxGHcgAKJ";
const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";

export async function aiNarrative(prompt: string, system: string): Promise<string> {
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
  return (data?.choices?.[0]?.message?.content ?? "").trim();
}
