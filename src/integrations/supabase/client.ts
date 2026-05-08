import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ikwtpojjpnshpchktbeh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlrd3Rwb2pqcG5zaHBjaGt0YmVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNzE5MDcsImV4cCI6MjA5Mzg0NzkwN30._ORO53TrjctW_abd8ohyLWvygkp3wSBgMJDmGY_woFQ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});