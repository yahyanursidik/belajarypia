import { PlaceholderDashboard } from "../../components/PlaceholderDashboard";

export function TeacherDashboardPage() {
  return (
    <PlaceholderDashboard
      role="Pengajar"
      title="Dashboard Pengajar"
      description="Kelas hari ini, review tugas, antrean setoran Qur'an, dan presensi akan tampil di sini."
      metrics={[
        { label: "Kelas Hari Ini", value: 0 },
        { label: "Review Tertunda", value: 0 },
        { label: "Setoran Qur'an", value: 0 },
      ]}
      nextItems={[
        "Integrasi role pengajar dan mentor",
        "Workspace kelas dan review",
        "Route presensi dan setoran manual",
      ]}
    />
  );
}
