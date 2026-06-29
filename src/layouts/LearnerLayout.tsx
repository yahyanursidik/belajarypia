import type { PropsWithChildren } from "react";
import { getNavigationForRole } from "../lib/navigation";
import { ShellLayout } from "./ShellLayout";

export function LearnerLayout({ children }: PropsWithChildren) {
  return (
    <ShellLayout
      title="Portal Peserta"
      subtitle="Akses belajar yang sederhana, terarah, dan ramah mobile"
      variant="learner"
      menuItems={getNavigationForRole("participant")}
    >
      {children}
    </ShellLayout>
  );
}
