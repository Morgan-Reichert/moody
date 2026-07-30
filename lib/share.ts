import { supabase } from "./supabase";

export interface SharePayload {
  patientName?: string;
  sheet?: { conditions?: string; allergies?: string; treatments?: string; bloodType?: string; height?: string; weight?: string };
  prescriptions?: { title: string; date?: string; expiry?: string; doctor?: string }[];
  symptoms?: { date: string; symptoms: string[]; intensity?: number }[];
  generatedAt: string;
}

export interface ConsumeResult {
  doctor_name: string | null;
  guest_allowed: boolean;
  payload: SharePayload;
  pdf_urls: string[];
}

function randToken(): string {
  const a = new Uint8Array(18); crypto.getRandomValues(a);
  return Array.from(a).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createShare(
  payload: SharePayload,
  pdfs: { name: string; blob: Blob }[],
  opts: { doctorName?: string; guestAllowed: boolean; ttlHours?: number },
): Promise<{ token: string; url: string }> {
  if (!supabase) throw new Error("not_configured");
  const token = randToken();
  const pdf_urls: string[] = [];
  for (let i = 0; i < pdfs.length; i++) {
    const safe = pdfs[i].name.replace(/[^\w.-]+/g, "_");
    const path = `${token}/${i}-${safe}`;
    const { error } = await supabase.storage.from("shares").upload(path, pdfs[i].blob, { contentType: "application/pdf", upsert: false });
    if (!error) { const { data } = supabase.storage.from("shares").getPublicUrl(path); pdf_urls.push(data.publicUrl); }
  }
  const expires_at = new Date(Date.now() + (opts.ttlHours ?? 24) * 3600e3).toISOString();
  const { error } = await supabase.from("shares").insert({
    token, expires_at, doctor_name: opts.doctorName ?? null, guest_allowed: opts.guestAllowed, payload, pdf_urls,
  });
  if (error) throw error;
  return { token, url: `${window.location.origin}/consult/?t=${token}` };
}

export async function consumeShare(token: string): Promise<ConsumeResult> {
  if (!supabase) throw new Error("not_configured");
  const { data, error } = await supabase.rpc("consume_share", { p_token: token });
  if (error) throw new Error(error.message || "error");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("not_found");
  return row as ConsumeResult;
}
