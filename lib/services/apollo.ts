import { ApolloClient, HttpLink, InMemoryCache, from } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";

import { env } from "@/lib/env";
import { supabase } from "@/lib/services/supabase";

const httpLink = new HttpLink({
  uri: env.graphqlEndpoint || "https://example.invalid/graphql",
});

const authLink = setContext(async (_, context) => {
  const sessionResult = await supabase.auth.getSession();
  const accessToken = sessionResult.data.session?.access_token ?? null;

  return {
    headers: {
      ...context.headers,
      apikey: env.supabasePublicKey,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  };
});

export const apolloClient = new ApolloClient({
  cache: new InMemoryCache({
    typePolicies: {
      Categories: { keyFields: ["nodeId"] },
      Hcps: { keyFields: ["nodeId"] },
      InsightActivities: { keyFields: ["nodeId"] },
      InsightTags: { keyFields: ["nodeId"] },
      Insights: { keyFields: ["nodeId"] },
      Tags: { keyFields: ["nodeId"] },
      UserPreferences: { keyFields: ["nodeId"] },
      Users: { keyFields: ["nodeId"] },
    },
  }),
  defaultOptions: {
    query: {
      fetchPolicy: "network-only",
    },
    watchQuery: {
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-first",
    },
  },
  link: from([authLink, httpLink]),
});
