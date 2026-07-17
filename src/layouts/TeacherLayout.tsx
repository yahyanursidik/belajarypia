import type { PropsWithChildren } from "react";
import { useAuthSession } from "../app/providers/authSessionContext";
import { getNavigationForRole } from "../lib/navigation";
import { ShellLayout } from "./ShellLayout";

export function TeacherLayout({ children }: PropsWithChildren) {
  const { primaryRole } = useAuthSession();
  const isMentor = primaryRole === "mentor";

  return (
    <ShellLayout
      title={isMentor ? "Ruang Musyrif" : "Ruang Pengajar"}
      subtitle={isMentor ? "Halaqah, peserta binaan, silabus, dan setoran Qur'an" : "Workspace kelas, review, presensi, dan materi"}
      variant="teacher"
      menuItems={getNavigationForRole(primaryRole)}
    >
      {children}
    </ShellLayout>
  );
}
