import type { Session, User as SupabaseAuthUser } from "@supabase/supabase-js";
import {
    PropsWithChildren,
    createContext,
    useContext,
    useEffect,
    useState,
} from "react";

import { hasSupabaseEnv } from "@/lib/env";
import { supabase } from "@/lib/services/supabase";

type Credentials = {
  email: string;
  password: string;
};

type DemoAccount = Credentials & {
  label: string;
};

type BackendContextValue = {
  isConfigured: boolean;
  session: Session | null;
  authUser: SupabaseAuthUser | null;
  isSessionLoading: boolean;
  authError: string | null;
  demoAccounts: DemoAccount[];
  signIn: (credentials: Credentials) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
};

const demoAccounts: DemoAccount[] = [
  {
    label: "Alice demo",
    email: "alice@test.com",
    password: "<alice-password>",
  },
  {
    label: "Bob demo",
    email: "bob@test.com",
    password: "<bob-password>",
  },
];

const BackendContext = createContext<BackendContextValue | null>(null);

export function BackendProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(hasSupabaseEnv);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSupabaseEnv) {
      setIsSessionLoading(false);
      return;
    }

    let isMounted = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) {
        return;
      }

      if (error) {
        setAuthError(error.message);
      }

      setSession(data.session ?? null);
      setIsSessionLoading(false);
    });

    const authListener = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!isMounted) {
          return;
        }

        setSession(nextSession ?? null);
        setIsSessionLoading(false);
      },
    );

    return () => {
      isMounted = false;
      authListener.data.subscription.unsubscribe();
    };
  }, []);

  const signIn = async ({ email, password }: Credentials) => {
    if (!hasSupabaseEnv) {
      setAuthError("Set the public Supabase URL and key before signing in.");
      return false;
    }

    setIsSessionLoading(true);
    setAuthError(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setAuthError(error.message);
      setIsSessionLoading(false);
      return false;
    }

    setSession(data.session ?? null);
    setIsSessionLoading(false);
    return true;
  };

  const signOut = async () => {
    if (!hasSupabaseEnv) {
      return;
    }

    setIsSessionLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(error.message);
    } else {
      setAuthError(null);
      setSession(null);
    }
    setIsSessionLoading(false);
  };

  return (
    <BackendContext.Provider
      value={{
        isConfigured: hasSupabaseEnv,
        session,
        authUser: session?.user ?? null,
        isSessionLoading,
        authError,
        demoAccounts,
        signIn,
        signOut,
        clearAuthError: () => setAuthError(null),
      }}
    >
      {children}
    </BackendContext.Provider>
  );
}

export function useBackend() {
  const context = useContext(BackendContext);

  if (!context) {
    throw new Error("useBackend must be used within BackendProvider");
  }

  return context;
}
