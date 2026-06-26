import type { PropsWithChildren } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthSession } from "../app/providers/authSessionContext";
import { FullPageLoader } from "../components/ui/full-page-loader";
import { canAccessPath, getDashboardPathForRole, type RoleCode } from "../lib/auth";

type ProtectedRouteProps = PropsWithChildren<{
  allowedRoles?: RoleCode[];
}>;

function getLoginPortalForPath(pathname: string) {
  if (pathname.startsWith("/admin") || pathname.startsWith("/system")) return "/admin/login";
  if (pathname.startsWith("/teacher")) return "/teacher/login";
  return "/learner/login";
}

export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const location = useLocation();
  const { isLoading, session, roles, primaryRole } = useAuthSession();

  if (isLoading) {
    return <FullPageLoader message="Memeriksa sesi login..." />;
  }

  if (!session) {
    return <Navigate to={getLoginPortalForPath(location.pathname)} replace state={{ from: location.pathname }} />;
  }

  const roleCodes = roles.map((role) => role.code);
  const hasAllowedRole = allowedRoles
    ? allowedRoles.some((role) => roleCodes.includes(role))
    : canAccessPath(location.pathname, roles);

  if (!hasAllowedRole) {
    return <Navigate to={getDashboardPathForRole(primaryRole)} replace />;
  }

  return children;
}

export function DashboardRedirect() {
  const { isLoading, session, primaryRole } = useAuthSession();

  if (isLoading) {
    return <FullPageLoader message="Mengarahkan dashboard..." />;
  }

  if (!session) {
    return <Navigate to="/learner/login" replace />;
  }

  return <Navigate to={getDashboardPathForRole(primaryRole)} replace />;
}
