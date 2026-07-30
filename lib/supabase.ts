import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Public config only. The anon key is safe client-side (protected by Row Level Security).
// Never put the service_role key here.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ygqxjqedctcjqlejreso.supabase.co";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabaseReady = !!(URL && ANON);
export const supabase: SupabaseClient | null = supabaseReady ? createClient(URL, ANON, { auth: { persistSession: false } }) : null;
