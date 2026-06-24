import type { PropsWithChildren } from "react";
import { useAuthSession } from "../app/providers/authSessionContext";
import { getNavigationForRole } from "../lib/navigation";
import { ShellLayout } from "./ShellLayout";

export function TeacherLayout({ children }: PropsWithChildren) {
  const { primaryRole } = useAuthSession();

  return (
    <ShellLayout
      title="Ruang Pengajar"
      subtitle="Workspace kelas, review, presensi, dan setoran Qur'an"
      variant="teacher"
      menuItems={getNavigationForRole(primaryRole)}
    >
      {children}
    </ShellLayout>
  );
}
