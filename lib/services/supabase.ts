import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

const fallbackUrl = env.supabaseUrl || "https://example.invalid";
const fallbackKey = env.supabasePublicKey || "missing-public-key";

export const supabase = createClient(fallbackUrl, fallbackKey, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: false,
    persistSession: true,
    storage: AsyncStorage,
  },
});
