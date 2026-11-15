import { createClient } from "@supabase/supabase-js";

// Mahmoud's Supabase project. The publishable key is designed to be public
// (it ships to every visitor's browser); access is enforced by the database's
// row-level security rules. Override with VITE_SUPABASE_* env vars if needed.
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? "https://xhlzukhrbqwbrpmhyxcr.supabase.co";
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_t7sSRZMF2ycICV5Hk4H0_Q_I51KWl6S";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storage: localStorage, persistSession: true, autoRefreshToken: true },
});
