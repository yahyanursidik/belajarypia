import { useCallback, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import {
  emptyAuthState,
  fetchAuthState,
  setCurrentAuthState,
  type AuthState,
} from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { AuthSessionContext, type AuthSessionContextValue } from "./authSessionContext";

export function AuthSessionProvider({ children }: PropsWithChildren) {
  const [authState, setAuthState] = useState<AuthState>(emptyAuthState);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const nextState = await fetchAuthState();
    setAuthState(nextState);
    setCurrentAuthState(nextState);
    setIsLoading(false);

    return nextState;
  }, []);

  useEffect(() => {
    void refresh();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refresh]);

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      ...authState,
      isLoading,
      refresh,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
          throw error;
        }

        return refresh();
      },
      signOut: async () => {
        await supabase.auth.signOut();
        setAuthState(emptyAuthState);
        setCurrentAuthState(emptyAuthState);
      },
    }),
    [authState, isLoading, refresh],
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}
