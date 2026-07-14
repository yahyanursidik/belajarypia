import { PlaceholderDashboard } from "../../components/PlaceholderDashboard";

export function AdminDashboardPage() {
  return (
    <PlaceholderDashboard
      role="Admin"
      title="Dashboard Admin"
      description="Ringkasan operasional pendaftaran, peserta, program, keuangan, sertifikat, helpdesk, dan jadwal akan tampil di sini."
      metrics={[
        { label: "Pendaftar Baru", value: 0 },
        { label: "Perlu Review", value: 0 },
        { label: "Program Aktif", value: 0 },
        { label: "Transaksi Perlu Cek", value: 0 },
      ]}
      nextItems={[
        "Sinkronkan pendaftaran, peserta, program, dan transaksi keuangan dalam ringkasan harian.",
        "Tampilkan transaksi pending, reminder donatur, dan jurnal akuntansi yang perlu rekonsiliasi.",
        "Sediakan shortcut operasional ke pendaftaran, peserta, program, keuangan, dan sertifikat.",
      ]}
    />
  );
}
