import type { AuthProvider } from "@refinedev/core";
import { fetchAuthState, getDashboardPathForRole } from "../../lib/auth";
import { supabase } from "../../lib/supabase";

export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return {
        success: false,
        error,
      };
    }

    const authState = await fetchAuthState();

    return {
      success: true,
      redirectTo: getDashboardPathForRole(authState.primaryRole),
    };
  },
  logout: async () => {
    await supabase.auth.signOut();

    return {
      success: true,
      redirectTo: "/auth/login",
    };
  },
  check: async () => {
    const authState = await fetchAuthState();

    if (!authState.session) {
      return {
        authenticated: false,
        redirectTo: "/auth/login",
      };
    }

    return {
      authenticated: true,
    };
  },
  getIdentity: async () => {
    const authState = await fetchAuthState();

    if (!authState.user) {
      return null;
    }

    return {
      id: authState.user.id,
      name:
        authState.profile?.full_name ??
        authState.profile?.email ??
        authState.user.email ??
        "Pengguna YPIA",
      email: authState.profile?.email ?? authState.user.email,
      roles: authState.roles.map((role) => role.code),
    };
  },
  onError: async (error) => ({
    error,
  }),
};
