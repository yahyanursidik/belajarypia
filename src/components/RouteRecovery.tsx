import { Component, useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "./ui/button";

class PageBoundary extends Component<{ children: ReactNode; home: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <section role="alert" className="agenda-empty">
      <h1>Halaman belum dapat dibuka</h1>
      <p>Muat ulang untuk mencoba kembali. Isian yang belum disimpan mungkin perlu diisi ulang.</p>
      <Button onClick={() => window.location.reload()}>Muat ulang halaman</Button>
      <Button variant="outline" asChild><Link to={this.props.home}>Kembali ke beranda</Link></Button>
    </section>;
  }
}
export function RouteRecovery({ children, home }: { children: ReactNode; home: string }) {
  const location = useLocation();
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  return <>
    {!online && <div role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Koneksi terputus. Sambungkan internet sebelum menyimpan atau mengirim jawaban.</div>}
    <PageBoundary key={location.pathname} home={home}>{children}</PageBoundary>
  </>;
}
