import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function HomePage() {
  return (
    <div className="page-stack">
      <section className="page-hero">
        <h2>YPIA Learning Management System</h2>
        <p>
          Fondasi awal portal belajar Yayasan Pendidikan Ihsanul Adab untuk
          program Qur'an, kitab, bahasa Arab, dan parenting.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/program">Lihat Program</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/auth/login">Masuk</Link>
          </Button>
        </div>
      </section>

      <div className="feature-grid">
        <Card>
          <CardHeader>
            <CardTitle>Publik</CardTitle>
          </CardHeader>
          <CardContent>
            Katalog program, detail program, pendaftaran, dan cek status akan
            ditempatkan di area ini.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Belajar</CardTitle>
          </CardHeader>
          <CardContent>
            Peserta akan melihat program aktif, jadwal, tugas, progres, dan
            bantuan secara sederhana.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Operasional</CardTitle>
          </CardHeader>
          <CardContent>
            Admin dan pengajar memakai workspace berbasis Refine untuk alur yang
            padat data.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
