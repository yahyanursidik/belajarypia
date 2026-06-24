import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { Program } from "../../lib/organization";
import { supabase } from "../../lib/supabase";

export function ProgramCatalogPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadPrograms() {
      const { data, error } = await supabase
        .from("programs")
        .select("id, unit_id, code, name, description, program_type, curriculum_model, delivery_mode, status, feature_flags, units(code, name)")
        .eq("status", "active")
        .order("name");

      if (error) {
        setErrorMessage(error.message);
      } else {
        setPrograms((data ?? []) as unknown as Program[]);
      }

      setIsLoading(false);
    }

    void loadPrograms();
  }, []);

  return (
    <div className="page-stack">
      <section className="page-hero">
        <h2>Program</h2>
        <p>
          Pilih program aktif yang tersedia, lihat detailnya, lalu isi formulir
          pendaftaran awal.
        </p>
      </section>

      {errorMessage ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Gagal memuat program: {errorMessage}
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Memuat program...
          </CardContent>
        </Card>
      ) : programs.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              title="Belum ada program"
              description="Program aktif akan tampil di sini setelah admin menerbitkannya."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="feature-grid">
          {programs.map((program) => (
            <Card key={program.id}>
              <CardContent className="space-y-4 pt-6">
                <div>
                  <Badge>{program.status}</Badge>
                  <h3 className="mt-3 text-lg font-semibold">{program.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {program.description ?? "Belum ada deskripsi program."}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground">
                  {program.units?.name ?? "Unit belum ditampilkan"} / {program.delivery_mode}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link to={`/program/${program.id}`}>Detail</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/program/${program.id}/daftar`}>Daftar</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          <EmptyState
            title="Catatan"
            description="Nomor induk peserta belum dibuat pada tahap pendaftaran. Nomor induk baru boleh dibuat setelah applicant diterima pada fase enrollment berikutnya."
          />
        </CardContent>
      </Card>
    </div>
  );
}
