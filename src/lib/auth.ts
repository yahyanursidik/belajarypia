import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type RoleCode =
  | "super_admin"
  | "admin"
  | "teacher"
  | "mentor"
  | "participant"
  | "guardian"
  | "finance"
  | "helpdesk"
  | "content_reviewer";

export type AppPermission =
  | "dashboard.view"
  | "users.manage"
  | "organizations.manage"
  | "units.manage"
  | "admission.manage"
  | "programs.manage"
  | "classes.manage"
  | "academic.manage"
  | "content.manage"
  | "documents.view"
  | "lessons.view"
  | "learning.view"
  | "finance.manage"
  | "helpdesk.manage"
  | "audit.view";

export type UserProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  status: string;
};

export type UserRole = {
  code: RoleCode;
  name: string;
  scopeType: string | null;
  scopeId: string | null;
};

export type AuthState = {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  roles: UserRole[];
  permissions: AppPermission[];
  primaryRole: RoleCode | null;
};

export const emptyAuthState: AuthState = {
  session: null,
  user: null,
  profile: null,
  roles: [],
  permissions: [],
  primaryRole: null,
};

const rolePriority: RoleCode[] = [
  "super_admin",
  "admin",
  "finance",
  "helpdesk",
  "content_reviewer",
  "teacher",
  "mentor",
  "participant",
  "guardian",
];

const permissionsByRole: Record<RoleCode, AppPermission[]> = {
  super_admin: [
    "dashboard.view",
    "users.manage",
    "organizations.manage",
    "units.manage",
    "admission.manage",
    "programs.manage",
    "classes.manage",
    "academic.manage",
    "content.manage",
    "documents.view",
    "lessons.view",
    "learning.view",
    "finance.manage",
    "helpdesk.manage",
    "audit.view",
  ],
  admin: ["dashboard.view", "admission.manage", "programs.manage", "classes.manage", "academic.manage", "content.manage", "documents.view"],
  teacher: ["dashboard.view", "classes.manage", "academic.manage", "content.manage", "documents.view", "lessons.view"],
  mentor: ["dashboard.view", "classes.manage", "academic.manage", "content.manage", "documents.view", "lessons.view"],
  participant: ["dashboard.view", "learning.view", "lessons.view", "documents.view"],
  guardian: ["dashboard.view", "learning.view", "lessons.view", "documents.view"],
  finance: ["dashboard.view", "finance.manage"],
  helpdesk: ["dashboard.view", "helpdesk.manage"],
  content_reviewer: ["dashboard.view", "programs.manage"],
};

const roleRoutePrefixes: Record<RoleCode, string[]> = {
  super_admin: ["/system"],
  admin: ["/admin"],
  finance: ["/admin"],
  helpdesk: ["/admin"],
  content_reviewer: ["/admin"],
  teacher: ["/teacher"],
  mentor: ["/teacher"],
  participant: ["/learner"],
  guardian: ["/learner"],
};

let currentAuthState: AuthState = emptyAuthState;

export function setCurrentAuthState(nextState: AuthState) {
  currentAuthState = nextState;
}

export function getCurrentAuthState() {
  return currentAuthState;
}

export function getPrimaryRole(roles: UserRole[]) {
  return rolePriority.find((role) => roles.some((item) => item.code === role)) ?? null;
}

export function getDashboardPathForRole(role: RoleCode | null) {
  if (!role) {
    return "/auth/no-role";
  }

  if (role === "super_admin") {
    return "/system";
  }

  if (["admin", "finance", "helpdesk", "content_reviewer"].includes(role)) {
    return "/admin";
  }

  if (["teacher", "mentor"].includes(role)) {
    return "/teacher";
  }

  return "/learner";
}

export function canAccessPath(pathname: string, roles: UserRole[]) {
  if (pathname === "/" || pathname.startsWith("/program") || pathname.startsWith("/auth")) {
    return true;
  }

  return roles.some((role) =>
    roleRoutePrefixes[role.code].some((prefix) => pathname.startsWith(prefix)),
  );
}

export function roleHasPermission(role: RoleCode, permission: AppPermission) {
  return permissionsByRole[role].includes(permission);
}

function mapRoleRows(rows: unknown): UserRole[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.flatMap((row) => {
    const item = row as {
      scope_type?: string | null;
      scope_id?: string | null;
      roles?: { code?: string; name?: string } | Array<{ code?: string; name?: string }>;
    };
    const role = Array.isArray(item.roles) ? item.roles[0] : item.roles;

    if (!role?.code || !rolePriority.includes(role.code as RoleCode)) {
      return [];
    }

    return {
      code: role.code as RoleCode,
      name: role.name ?? role.code,
      scopeType: item.scope_type ?? null,
      scopeId: item.scope_id ?? null,
    };
  });
}

function resolvePermissions(roles: UserRole[]) {
  return Array.from(
    new Set(roles.flatMap((role) => permissionsByRole[role.code])),
  ) as AppPermission[];
}

export async function fetchAuthState(): Promise<AuthState> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !sessionData.session) {
    return emptyAuthState;
  }

  const { user } = sessionData.session;
  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, status")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("user_roles")
      .select("scope_type, scope_id, roles(code, name)")
      .eq("user_id", user.id),
  ]);

  const roles = mapRoleRows(roleRows);
  const nextState: AuthState = {
    session: sessionData.session,
    user,
    profile: (profile as UserProfile | null) ?? {
      id: user.id,
      full_name: user.user_metadata.full_name ?? user.user_metadata.name ?? null,
      email: user.email ?? null,
      status: "active",
    },
    roles,
    permissions: resolvePermissions(roles),
    primaryRole: getPrimaryRole(roles),
  };

  setCurrentAuthState(nextState);

  return nextState;
}
