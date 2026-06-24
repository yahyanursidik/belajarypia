import { PlaceholderDashboard } from "../../components/PlaceholderDashboard";

export function AdminDashboardPage() {
  return (
    <PlaceholderDashboard
      role="Admin"
      title="Dashboard Admin"
      description="Ringkasan operasional pendaftaran, peserta, enrollment, program, helpdesk, dan jadwal akan tampil di sini."
      metrics={[
        { label: "Pendaftar Baru", value: 0 },
        { label: "Perlu Review", value: 0 },
        { label: "Program Aktif", value: 0 },
      ]}
      nextItems={[
        "Integrasi auth dan role admin",
        "Resource Refine untuk pendaftaran dan peserta",
        "Navigasi berbasis izin",
      ]}
    />
  );
}
