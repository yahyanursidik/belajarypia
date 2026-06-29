import type { PropsWithChildren } from "react";
import { useAuthSession } from "../app/providers/authSessionContext";
import { getNavigationForRole } from "../lib/navigation";
import { ShellLayout } from "./ShellLayout";

export function SuperAdminLayout({ children }: PropsWithChildren) {
  const { primaryRole } = useAuthSession();

  return (
    <ShellLayout
      title="Pusat Kendali Sistem YPIA"
      subtitle="Tata Kelola & Pemantauan LMS YPIA"
      variant="superadmin"
      menuItems={getNavigationForRole(primaryRole)}
    >
      {children}
    </ShellLayout>
  );
}
