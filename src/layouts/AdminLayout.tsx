import type { PropsWithChildren } from "react";
import { useAuthSession } from "../app/providers/authSessionContext";
import { getNavigationForRole } from "../lib/navigation";
import { ShellLayout } from "./ShellLayout";

export function AdminLayout({ children }: PropsWithChildren) {
  const { primaryRole } = useAuthSession();

  return (
    <ShellLayout
      title={primaryRole === "finance" ? "Ruang Keuangan" : primaryRole === "helpdesk" ? "Ruang Layanan" : primaryRole === "content_reviewer" ? "Ruang Reviewer" : "Ruang Admin"}
      subtitle="Workspace operasional untuk pendaftaran, program, dan peserta"
      variant="admin"
      menuItems={getNavigationForRole(primaryRole)}
    >
      {children}
    </ShellLayout>
  );
}
