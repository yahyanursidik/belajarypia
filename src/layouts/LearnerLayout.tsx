import type { PropsWithChildren } from "react";
import { useAuthSession } from "../app/providers/authSessionContext";
import { getNavigationForRole } from "../lib/navigation";
import { ShellLayout } from "./ShellLayout";

export function LearnerLayout({ children }: PropsWithChildren) {
  const { primaryRole } = useAuthSession();
  const learnerRole = primaryRole === "guardian" ? "guardian" : "participant";

  return (
    <ShellLayout
      title={learnerRole === "guardian" ? "Ruang Wali" : "Ruang Belajar"}
      subtitle={learnerRole === "guardian" ? "Perkembangan dan pendampingan anak" : "Program, tugas, dan progres belajar"}
      variant="learner"
      menuItems={getNavigationForRole(learnerRole)}
    >
      {children}
    </ShellLayout>
  );
}
