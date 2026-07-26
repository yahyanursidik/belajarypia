import {
  ArrowRight,
  BookOpenCheck,
  BriefcaseBusiness,
  ClipboardCheck,
  CreditCard,
  UserRoundCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";

const operationalMetrics = [
  { label: "Pendaftar Baru", value: 0, hint: "Hari ini", icon: ClipboardCheck, tone: "admin-metric--blue" },
  { label: "Perlu Review", value: 0, hint: "Menunggu keputusan", icon: UserRoundCheck, tone: "admin-metric--amber" },
  { label: "Program Aktif", value: 0, hint: "Sedang berjalan", icon: BookOpenCheck, tone: "admin-metric--green" },
  { label: "Transaksi Perlu Cek", value: 0, hint: "Belum diverifikasi", icon: CreditCard, tone: "admin-metric--rose" },
];

const workflows = [
  {
    title: "Review pendaftaran",
    description: "Periksa data calon peserta dan lanjutkan keputusan admisi.",
    href: "/admin/pendaftaran?tab=review",
    icon: ClipboardCheck,
  },
  {
    title: "Kelola peserta",
    description: "Buka direktori, enrollment, dan kelengkapan profil peserta.",
    href: "/admin/peserta?tab=directory",
    icon: UserRoundCheck,
  },
  {
    title: "Atur program",
    description: "Kelola program, kelas, kurikulum, dan materi pembelajaran.",
    href: "/admin/program",
    icon: BookOpenCheck,
  },
];

export function AdminDashboardPage() {
  const today = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="page-stack admin-dashboard">
      <section className="admin-command-bar">
        <div className="admin-command-bar__icon">
          <BriefcaseBusiness className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <Badge variant="outline" className="mb-2 bg-white">OPERASIONAL HARIAN</Badge>
          <h2>Dashboard Admin</h2>
          <p>Pantau antrean kerja dan buka proses yang paling membutuhkan tindakan.</p>
        </div>
        <div className="admin-command-bar__date">
          <span>Hari ini</span>
          <strong>{today}</strong>
        </div>
      </section>

      <section className="admin-metric-grid" aria-label="Ringkasan operasional">
        {operationalMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label} className={`admin-metric ${metric.tone}`}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="admin-metric__icon"><Icon className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <p>{metric.label}</p>
                  <div className="flex items-end gap-2">
                    <strong>{metric.value}</strong>
                    <span>{metric.hint}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.6fr)]">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Meja Kerja Admin</CardTitle>
            <CardDescription>Alur utama yang paling sering digunakan dalam operasional program.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {workflows.map((workflow) => {
              const Icon = workflow.icon;
              return (
                <Link key={workflow.title} to={workflow.href} className="admin-workflow">
                  <Icon className="h-5 w-5" />
                  <strong>{workflow.title}</strong>
                  <span>{workflow.description}</span>
                  <span className="admin-workflow__action">
                    Buka modul <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Antrean Prioritas</CardTitle>
            <CardDescription>Item yang perlu segera ditindaklanjuti.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="admin-empty-queue">
              <ClipboardCheck className="h-6 w-6" />
              <strong>Belum ada antrean</strong>
              <span>Antrean review dan verifikasi akan muncul di area ini.</span>
            </div>
            <Button asChild variant="outline" className="mt-4 w-full">
              <Link to="/admin/pendaftaran?tab=review">
                Lihat semua pendaftar
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
