const trimValue = (value: string | undefined) => value?.trim() ?? "";

export const env = {
  supabaseUrl: trimValue(process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabasePublishableKey: trimValue(
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
  supabasePublicKey: trimValue(
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
  graphqlEndpoint: trimValue(process.env.EXPO_PUBLIC_SUPABASE_URL)
    ? `${trimValue(process.env.EXPO_PUBLIC_SUPABASE_URL).replace(/\/$/, "")}/graphql/v1`
    : "",
};

export const hasSupabaseEnv = Boolean(env.supabaseUrl && env.supabasePublicKey);

export const configuredSupabaseKeyType = env.supabasePublishableKey
  ? "publishable"
  : null;

export const configuredSupabaseHost = env.supabaseUrl
  ? env.supabaseUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")
  : null;
