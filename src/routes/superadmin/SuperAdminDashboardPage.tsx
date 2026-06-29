import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { 
  Server, ShieldCheck, Users, Activity, Building, Database, 
  ArrowRight, BookOpen, Users as UsersIcon, FileText, BadgeDollarSign, 
  Headset, FileCheck, ShieldAlert, GraduationCap, BarChart3
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { supabase } from "../../lib/supabase";

export function SuperAdminDashboardPage() {
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({ users: 0, programs: 0, participants: 0, units: 0 });

  useEffect(() => {
    async function fetchData() {
      try {
        const [logsRes, usersRes, programsRes, participantsRes, unitsRes] = await Promise.all([
          supabase.from("audit_logs").select("*, profiles(full_name)").order("created_at", { ascending: false }).limit(5),
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("programs").select("id", { count: "exact", head: true }),
          supabase.from("participants").select("id", { count: "exact", head: true }),
          supabase.from("units").select("id", { count: "exact", head: true }),
        ]);

        if (!logsRes.error && logsRes.data) setRecentLogs(logsRes.data);
        setMetrics({
          users: usersRes.count ?? 0,
          programs: programsRes.count ?? 0,
          participants: participantsRes.count ?? 0,
          units: unitsRes.count ?? 0,
        });
      } catch (err) {
        console.error("Failed to fetch dashboard data", err);
      }
    }
    fetchData();
  }, []);

  const shortcuts = [
    { to: "/system/pendaftaran", icon: FileText, label: "Pendaftaran", desc: "Kelola calon peserta" },
    { to: "/system/peserta", icon: UsersIcon, label: "Data Peserta", desc: "Direktori profil" },
    { to: "/system/program", icon: BookOpen, label: "Program", desc: "Katalog & kurikulum" },
    { to: "/system/keuangan", icon: BadgeDollarSign, label: "Keuangan", desc: "Transaksi & tagihan" },
    { to: "/system/audit", icon: ShieldAlert, label: "Audit Log", desc: "Riwayat aktivitas" },
    { to: "/system/pengaturan", icon: FileCheck, label: "Pengaturan", desc: "Konfigurasi sistem" },
  ];

  return (
    <div className="page-stack space-y-6 pb-12">
      {/* Hero Banner — uses page-hero for dynamic theme */}
      <section className="page-hero">
        <Badge variant="secondary" className="mb-4 bg-white/20 text-white border-white/30 backdrop-blur-sm shadow-sm">
          SUPER ADMIN PANEL
        </Badge>
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="hidden md:flex h-20 w-20 rounded-2xl bg-white/10 backdrop-blur-xl items-center justify-center border border-white/20 shadow-inner">
            <Server className="h-10 w-10 text-white drop-shadow-md" />
          </div>
          <div>
            <p className="text-white/70 text-sm font-medium mb-1 tracking-wide uppercase">Assalamu'alaikum 👋</p>
            <h2 className="text-white text-3xl font-bold tracking-tight">Pusat Kendali Sistem YPIA</h2>
            <p className="text-white/80 max-w-xl text-sm leading-relaxed mt-1">
              Pantau kesehatan server, kelola hak akses global, dan navigasikan seluruh modul operasional LMS dari satu tempat.
            </p>
          </div>
        </div>
      </section>

      {/* Live Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-xl border-border/40 shadow-sm hover:shadow-md hover:border-primary/20 transition-all group bg-primary/5 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-20 h-20 bg-primary/10 rounded-bl-full -mr-3 -mt-3 transition-transform group-hover:scale-110"></div>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-primary">Total Pengguna</CardTitle>
            <Users className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-foreground">{metrics.users.toLocaleString('id-ID')}</div>
            <p className="text-xs text-muted-foreground mt-1">Akun terdaftar</p>
          </CardContent>
        </Card>
        
        <Card className="rounded-xl border-border/40 shadow-sm hover:shadow-md hover:border-primary/20 transition-all group">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Program</CardTitle>
            <GraduationCap className="h-4 w-4 text-primary/70 group-hover:scale-110 transition-transform" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-foreground">{metrics.programs}</div>
            <p className="text-xs text-muted-foreground mt-1">Program aktif</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/40 shadow-sm hover:shadow-md hover:border-primary/20 transition-all group">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Peserta</CardTitle>
            <BarChart3 className="h-4 w-4 text-primary/70 group-hover:scale-110 transition-transform" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-foreground">{metrics.participants.toLocaleString('id-ID')}</div>
            <p className="text-xs text-muted-foreground mt-1">Peserta terdaftar</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/40 shadow-sm hover:shadow-md hover:border-primary/20 transition-all group">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unit Aktif</CardTitle>
            <Building className="h-4 w-4 text-primary/70 group-hover:scale-110 transition-transform" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-foreground">{metrics.units}</div>
            <p className="text-xs text-muted-foreground mt-1">Unit operasional</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Quick Actions */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/40 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-border/40">
              <CardTitle>Pintasan Operasional</CardTitle>
              <CardDescription>Akses cepat ke modul-modul administratif utama.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {shortcuts.map((s) => (
                  <Link key={s.to} to={s.to}>
                    <Button variant="outline" className="w-full h-28 flex flex-col gap-2 items-center justify-center hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-all group/btn">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover/btn:bg-primary/20 transition-colors">
                        <s.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="text-center">
                        <span className="text-sm font-semibold block">{s.label}</span>
                        <span className="text-[10px] text-muted-foreground">{s.desc}</span>
                      </div>
                    </Button>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-border/40 shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b border-border/40">
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Infrastruktur
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 rounded-xl border border-border/50 bg-slate-50/50 hover:bg-slate-50 transition-colors gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-white rounded-lg border shadow-sm mt-0.5">
                      <Server className="h-4 w-4 text-slate-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Supabase Database</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Koneksi stabil, sinkronisasi otomatis berjalan normal</p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 w-fit shrink-0">Aktif & Sinkron</Badge>
                </div>
                
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 rounded-xl border border-border/50 bg-slate-50/50 hover:bg-slate-50 transition-colors gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-white rounded-lg border shadow-sm mt-0.5">
                      <Database className="h-4 w-4 text-slate-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Penyimpanan Storage (Contabo S3)</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Digunakan untuk menyimpan video & materi modul</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-slate-600 w-fit shrink-0">Aman</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Audit Logs & Security */}
        <div className="space-y-6">
          <Card className="border-border/40 shadow-sm h-full flex flex-col">
            <CardHeader className="pb-3 border-b border-border/30 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <ShieldAlert className="h-4 w-4 text-primary" />
                  Aktivitas Terbaru
                </CardTitle>
                <Link to="/system/audit">
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-5 flex-1">
              {recentLogs.length > 0 ? (
                <div className="space-y-5">
                  {recentLogs.map((log, i) => (
                    <div key={log.id} className="flex gap-3 relative">
                      {/* Vertical line connector */}
                      {i !== recentLogs.length - 1 && (
                        <div className="absolute left-[11px] top-[24px] bottom-[-20px] w-px bg-border" />
                      )}
                      
                      <div className="relative z-10 mt-1 rounded-full bg-primary/10 border border-primary/20 p-1 h-6 w-6 flex items-center justify-center shrink-0">
                        <Activity className="h-3 w-3 text-primary" />
                      </div>
                      
                      <div className="flex-1 pb-1">
                        <div className="flex justify-between items-start">
                          <p className="text-sm font-medium leading-none text-foreground/90">
                            {log.profiles?.full_name || "Sistem"}
                          </p>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                            {format(new Date(log.created_at), "HH:mm")}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 flex items-center flex-wrap gap-1.5">
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-mono bg-slate-50 text-slate-600">
                            {log.action}
                          </Badge>
                          pada <span className="capitalize text-foreground/80 font-medium">{log.entity_type}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                  
                  <div className="pt-2">
                    <Link to="/system/audit" className="block w-full">
                      <Button variant="outline" className="w-full text-xs h-9 hover:bg-primary/5 hover:text-primary transition-colors">
                        Lihat Semua Audit Sistem
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-3 py-12 opacity-70">
                  <div className="p-4 bg-primary/10 rounded-full">
                    <ShieldCheck className="h-8 w-8 text-primary/60" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">Sistem Aman Terkendali</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[200px] mx-auto">
                      Belum ada pergerakan atau aktivitas mencurigakan yang terekam.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
