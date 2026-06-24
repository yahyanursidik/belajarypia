import { Server, ShieldCheck, Users, Activity, Building, Database } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";

export function SuperAdminDashboardPage() {
  return (
    <div className="page-stack">
      {/* Hero Banner */}
      <section className="page-hero bg-slate-900 border-none">
        <Badge variant="secondary" className="mb-4 bg-white/20 hover:bg-white/30 text-white border-white/10 backdrop-blur-sm">SUPERADMIN</Badge>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex h-16 w-16 rounded-2xl bg-white/10 backdrop-blur-md items-center justify-center border border-white/20">
            <Server className="h-8 w-8 text-white" />
          </div>
          <div>
            <h2 className="text-white">Pusat Kendali Sistem YPIA</h2>
            <p className="text-slate-300">
              Overview kesehatan server, pengaturan global, dan tata kelola unit secara keseluruhan.
            </p>
          </div>
        </div>
      </section>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-md transition-all">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status Server</CardTitle>
            <Activity className="h-4 w-4 text-emerald-500 opacity-70" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">Normal</div>
            <p className="text-xs text-muted-foreground mt-1">Uptime 99.9%</p>
          </CardContent>
        </Card>
        
        <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-md transition-all">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pengguna</CardTitle>
            <Users className="h-4 w-4 text-blue-500 opacity-70" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">1,248</div>
            <p className="text-xs text-muted-foreground mt-1">+12 hari ini</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-md transition-all">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unit Aktif</CardTitle>
            <Building className="h-4 w-4 text-purple-500 opacity-70" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">4</div>
            <p className="text-xs text-muted-foreground mt-1">TK, SD, SMP, SMA</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-md transition-all">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Keamanan</CardTitle>
            <ShieldCheck className="h-4 w-4 text-emerald-500 opacity-70" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">Aman</div>
            <p className="text-xs text-muted-foreground mt-1">0 ancaman terdeteksi</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Quick Actions / System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card className="rounded-xl border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Sistem Database
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 rounded-lg border border-border/50 bg-muted/30">
                <div>
                  <p className="font-medium text-sm">Supabase Sync</p>
                  <p className="text-xs text-muted-foreground">Sinkronisasi terakhir 2 menit yang lalu</p>
                </div>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200">Aktif</Badge>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg border border-border/50 bg-muted/30">
                <div>
                  <p className="font-medium text-sm">Penyimpanan Storage</p>
                  <p className="text-xs text-muted-foreground">Kapasitas terpakai: 45GB / 100GB</p>
                </div>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200">Normal</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
