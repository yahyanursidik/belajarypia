import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { Program } from "../../lib/organization";
import { supabase } from "../../lib/supabase";

export function ProgramDetailPage() {
  const { programId } = useParams();
  const [program, setProgram] = useState<Program | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadProgram() {
      if (!programId) {
        setIsLoading(false);
        return;
      }

      const { data } = await supabase
        .from("programs")
        .select("id, unit_id, code, name, description, program_type, curriculum_model, delivery_mode, status, feature_flags, units(code, name)")
        .eq("id", programId)
        .eq("status", "active")
        .maybeSingle();

      setProgram((data as unknown as Program | null) ?? null);
      setIsLoading(false);
    }

    void loadProgram();
  }, [programId]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Memuat detail program...</p>;
  }

  if (!program) {
    return (
      <EmptyState
        title="Program tidak ditemukan"
        description="Program mungkin belum aktif atau tidak tersedia untuk publik."
      />
    );
  }

  return (
    <div className="page-stack">
      <section className="page-hero">
        <Badge>{program.status}</Badge>
        <h2>{program.name}</h2>
        <p>{program.description ?? "Detail program akan dilengkapi oleh admin."}</p>
        <Button asChild>
          <Link to={`/program/${program.id}/daftar`}>Daftar Program</Link>
        </Button>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Informasi Program</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="detail-grid">
            <div>
              <dt>Kode</dt>
              <dd>{program.code}</dd>
            </div>
            <div>
              <dt>Unit</dt>
              <dd>{program.units?.name ?? "-"}</dd>
            </div>
            <div>
              <dt>Tipe</dt>
              <dd>{program.program_type}</dd>
            </div>
            <div>
              <dt>Model Kurikulum</dt>
              <dd>{program.curriculum_model}</dd>
            </div>
            <div>
              <dt>Mode Belajar</dt>
              <dd>{program.delivery_mode}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
