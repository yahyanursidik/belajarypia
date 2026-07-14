import type { PropsWithChildren } from "react";
import { useAuthSession } from "../app/providers/authSessionContext";
import { getNavigationForRole } from "../lib/navigation";
import { useSystemSettings } from "../lib/useSystemSettings";
import { ShellLayout } from "./ShellLayout";

export function SuperAdminLayout({ children }: PropsWithChildren) {
  const { primaryRole } = useAuthSession();
  const { settings } = useSystemSettings();
  const headerTitle = settings?.system_header_title || "Pusat Kendali Sistem";
  const headerSubtitle = settings?.system_header_subtitle || "Tata Kelola & Pemantauan LMS";

  return (
    <ShellLayout
      title={headerTitle}
      subtitle={headerSubtitle}
      variant="superadmin"
      menuItems={getNavigationForRole(primaryRole)}
    >
      {children}
    </ShellLayout>
  );
}
