import { createContext, useContext } from "react";
import type { AuthState } from "../../lib/auth";
import { getDashboardPathForRole } from "../../lib/auth";

export type AuthSessionContextValue = AuthState & {
  isLoading: boolean;
  refresh: () => Promise<AuthState>;
  signIn: (email: string, password: string) => Promise<AuthState>;
  signOut: () => Promise<void>;
};

export const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function useAuthSession() {
  const context = useContext(AuthSessionContext);

  if (!context) {
    throw new Error("useAuthSession must be used within AuthSessionProvider");
  }

  return context;
}

export function useRoleDashboardPath() {
  const { primaryRole } = useAuthSession();

  return getDashboardPathForRole(primaryRole);
}
