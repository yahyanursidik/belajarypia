import { useCallback, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import {
  emptyAuthState,
  fetchAuthState,
  setCurrentAuthState,
  type AuthState,
} from "../../lib/auth";
import { getAuthRedirectUrl } from "../../lib/authRedirects";
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
      signIn: async (email, password, captchaToken) => {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
          options: {
            captchaToken,
          },
        });

        if (error) {
          throw error;
        }

        return refresh();
      },
      requestPasswordReset: async (email, redirectTo, captchaToken) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo,
          captchaToken,
        });

        if (error) {
          throw error;
        }
      },
      updatePassword: async (password) => {
        const { error } = await supabase.auth.updateUser({
          password,
        });

        if (error) {
          throw error;
        }

        return refresh();
      },
      signInLearnerWithGoogle: async () => {
        const redirectTo = getAuthRedirectUrl("/learner/auth/callback");
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo,
          },
        });

        if (error) {
          throw error;
        }
      },
      signUpLearner: async (fullName, email, password, captchaToken) => {
        const redirectTo = getAuthRedirectUrl("/learner/auth/callback");
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            captchaToken,
            emailRedirectTo: redirectTo,
            data: {
              full_name: fullName.trim(),
              signup_portal: "learner",
            },
          },
        });

        if (error) {
          throw error;
        }

        if (!data.session) {
          return {
            authState: null,
            requiresEmailConfirmation: true,
          };
        }

        const { error: identityError } = await supabase.rpc("ensure_learner_identity");
        if (identityError) {
          await supabase.auth.signOut();
          setAuthState(emptyAuthState);
          setCurrentAuthState(emptyAuthState);
          throw identityError;
        }

        return {
          authState: await refresh(),
          requiresEmailConfirmation: false,
        };
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
