import type { PropsWithChildren } from "react";
import { ShellLayout } from "./ShellLayout";
import { getNavigationForRole } from "../lib/navigation";

export function PublicLayout({ children }: PropsWithChildren) {
  return (
    <ShellLayout
      title="Portal Publik"
      subtitle="Informasi program dan akses awal LMS YPIA"
      variant="public"
      menuItems={getNavigationForRole(null)}
    >
      {children}
    </ShellLayout>
  );
}
