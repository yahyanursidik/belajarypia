import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpenCheck, ClipboardCheck, CreditCard, RefreshCw, Users } from "lucide-react";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { PageHeader } from "../../components/admin/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { getNavigationForRole } from "../../lib/navigation";
import { supabase } from "../../lib/supabase";

type Metric = { key: string; title: string; href: string; tone: string; icon: typeof Users; count: number | null; failed: boolean };

export function AdminDashboardPage() {
  const { primaryRole } = useAuthSession();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const menu = getNavigationForRole(primaryRole).filter((item) => item.href !== "/admin");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setMetrics([]);
    const requests = [];
    if (primaryRole === "admin") {
      requests.push(
        { key: "review", title: "Pendaftar perlu ditinjau", href: "/admin/pendaftaran?tab=review", tone: "amber", icon: ClipboardCheck,
          query: supabase.from("applicants").select("id", { count: "exact", head: true }).in("status", ["submitted", "under_review", "revision_requested"]) },
        { key: "draft", title: "Program draf", href: "/admin/program?status=draft", tone: "violet", icon: BookOpenCheck,
          query: supabase.from("programs").select("id", { count: "exact", head: true }).eq("status", "draft") },
        { key: "active", title: "Program aktif", href: "/admin/program?status=active", tone: "emerald", icon: Users,
          query: supabase.from("programs").select("id", { count: "exact", head: true }).eq("status", "active") },
      );
    }
    if (primaryRole === "admin" || primaryRole === "finance") requests.push(
      { key: "payments", title: "Pembayaran menunggu", href: "/admin/keuangan?tab=transactions", tone: "blue", icon: CreditCard,
        query: supabase.from("transactions").select("id", { count: "exact", head: true }).eq("status", "pending") },
    );
    void Promise.all(requests.map(async ({ query, ...metric }) => {
      try {
        const { count, error } = await query.abortSignal(controller.signal);
        return { ...metric, count: error ? null : count, failed: Boolean(error) };
      } catch {
        return { ...metric, count: null, failed: true };
      }
    })).then((results) => {
      if (!controller.signal.aborted) { setMetrics(results); setLoading(false); }
    });
    return () => controller.abort();
  }, [primaryRole, reload]);

  const failed = metrics.some((metric) => metric.failed);
  const queue = metrics.filter((metric) => metric.key !== "active" && metric.count !== null && metric.count > 0);
  return <div className="page-stack admin-dashboard">
    <PageHeader title="Dashboard" eyebrow="Hari ini" actions={<Button variant="outline" disabled={loading} onClick={() => setReload((value) => value + 1)}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Muat ulang</Button>} />
    {failed && <Alert><AlertTitle>Sebagian data belum tersedia</AlertTitle><AlertDescription>Coba muat ulang. Angka yang belum tersedia ditandai dengan —.</AlertDescription></Alert>}
    <section className="admin-stat-grid" aria-label="Ringkasan pekerjaan" aria-busy={loading}>
      {loading ? <p role="status">Memuat ringkasan…</p> : metrics.map(({ key, title, href, tone, icon: Icon, count, failed: unavailable }) =>
        <Link to={href} key={key} className={`admin-stat admin-tone-${tone}`}>
          <span className="admin-stat__icon"><Icon size={20} /></span><span><span className="admin-stat__label">{title}</span><strong>{count ?? "—"}</strong>{unavailable && <small>Belum tersedia</small>}</span><ArrowRight size={16} />
        </Link>)}
    </section>
    <div className="admin-dashboard-grid">
      <Card><CardHeader><CardTitle>Perlu tindakan</CardTitle></CardHeader><CardContent>
        {loading ? <p role="status">Memuat antrean…</p> : queue.length ? <ul className="admin-task-list">{queue.map((item) => <li key={item.key}><Link to={item.href}><span className={`admin-task-count admin-tone-${item.tone}`}>{item.count}</span><span>{item.title}</span><ArrowRight size={17} /></Link></li>)}</ul>
          : <p className="admin-quiet-state">{failed ? "Antrean belum dapat dipastikan. Coba muat ulang." : metrics.length ? "Semua beres. Tidak ada antrean pada ringkasan ini." : "Buka modul Anda untuk melihat pekerjaan terbaru."}</p>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Akses cepat</CardTitle></CardHeader><CardContent className="admin-shortcuts">
        {menu.map(({ href, label, icon: Icon }) => <Link to={href} key={href}><Icon className="h-4 w-4" /><span>{label}</span><ArrowRight size={15} /></Link>)}
      </CardContent></Card>
    </div>
  </div>;
}
