import type { PropsWithChildren } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthSession } from "../app/providers/authSessionContext";
import { Card, CardContent } from "../components/ui/card";
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
    return (
      <Card className="m-6">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Memeriksa sesi login...
        </CardContent>
      </Card>
    );
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
    return (
      <Card className="m-6">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Mengarahkan dashboard...
        </CardContent>
      </Card>
    );
  }

  if (!session) {
    return <Navigate to="/learner/login" replace />;
  }

  return <Navigate to={getDashboardPathForRole(primaryRole)} replace />;
}
