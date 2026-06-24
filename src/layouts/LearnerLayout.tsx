import type { PropsWithChildren } from "react";
import { useAuthSession } from "../app/providers/authSessionContext";
import { getNavigationForRole } from "../lib/navigation";
import { ShellLayout } from "./ShellLayout";

export function LearnerLayout({ children }: PropsWithChildren) {
  const { primaryRole } = useAuthSession();

  return (
    <ShellLayout
      title="Portal Peserta"
      subtitle="Akses belajar yang sederhana, terarah, dan ramah mobile"
      variant="learner"
      menuItems={getNavigationForRole(primaryRole)}
    >
      {children}
    </ShellLayout>
  );
}
