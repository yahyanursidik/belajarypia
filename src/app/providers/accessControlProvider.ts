import type { AccessControlProvider } from "@refinedev/core";
import {
  getCurrentAuthState,
  roleHasPermission,
  type AppPermission,
  type RoleCode,
} from "../../lib/auth";

export const accessControlProvider: AccessControlProvider = {
  can: async ({ action, resource }) => {
    const authState = getCurrentAuthState();

    if (!authState.session || authState.roles.length === 0) {
      return {
        can: false,
        reason: "Silakan login terlebih dahulu.",
      };
    }

    if (authState.roles.some((role) => role.code === "super_admin")) {
      return { can: true };
    }

    const permission = mapResourceActionToPermission(resource, action);

    if (!permission) {
      return {
        can: false,
        reason: "Aksi ini belum terdaftar dalam permission Phase 1.",
      };
    }

    const can = authState.roles.some((role) =>
      roleHasPermission(role.code as RoleCode, permission),
    );

    return {
      can,
      reason: can ? undefined : "Role Anda belum memiliki akses ke fitur ini.",
    };
  },
};

function mapResourceActionToPermission(
  resource: string | undefined,
  action: string | undefined,
): AppPermission | null {
  if (action === "list" && resource?.includes("dashboard")) {
    return "dashboard.view";
  }

  if (resource?.includes("admin")) {
    return "programs.manage";
  }

  if (resource === "applicants") {
    return "admission.manage";
  }

  if (resource === "organizations") {
    return "organizations.manage";
  }

  if (resource === "units") {
    return "units.manage";
  }

  if (resource === "programs") {
    return "programs.manage";
  }

  if (
    resource === "batches" ||
    resource === "classes" ||
    resource === "halaqahs" ||
    resource === "levels" ||
    resource === "program_modules" ||
    resource === "lesson_prerequisites"
  ) {
    return "academic.manage";
  }

  if (resource === "lessons") {
    return action === "list" || action === "show" ? "lessons.view" : "content.manage";
  }

  if (resource === "document_files") {
    return action === "list" || action === "show" ? "documents.view" : "content.manage";
  }

  if (resource?.includes("teacher")) {
    return "classes.manage";
  }

  if (resource?.includes("learner")) {
    return "learning.view";
  }

  if (resource?.includes("superadmin")) {
    return "audit.view";
  }

  return "dashboard.view";
}
