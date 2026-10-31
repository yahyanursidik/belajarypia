import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import {
  getRegistrationWindowState,
  type RegistrationForm,
} from "../../lib/admission";
import type { LearnerPortal } from "../../lib/learnerWorkspace";
type CatalogProgram = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  feature_flags: {
    use_direct_enrollment?: boolean;
    use_payment?: boolean;
  } | null;
};
export function LearnerCatalog({
  data,
  onEnrolled,
}: {
  data: LearnerPortal;
  onEnrolled: () => void;
}) {
  const [rows, setRows] = useState<CatalogProgram[]>([]),
    [forms, setForms] = useState<RegistrationForm[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [selected, setSelected] = useState<CatalogProgram | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const existing = data.enrollments
    .map((e) => e.program_id)
    .sort()
    .join(",");
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const r = await supabase
          .from("programs")
          .select("id,code,name,description,feature_flags")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .abortSignal(c.signal);
        if (r.error) throw r.error;
        const available = (r.data ?? []).filter(
          (p) => !existing.split(",").includes(p.id),
        ) as CatalogProgram[];
        const f = available.length
          ? await supabase
              .from("registration_forms")
              .select(
                "id,program_id,title,status,registration_open_at,registration_close_at,created_at",
              )
              .in(
                "program_id",
                available.map((p) => p.id),
              )
              .eq("status", "active")
              .order("created_at", { ascending: false })
              .abortSignal(c.signal)
          : { data: [], error: null };
        if (f.error) throw f.error;
        if (!c.signal.aborted) {
          setRows(available);
          setForms((f.data ?? []) as RegistrationForm[]);
        }
      } catch {
        if (!c.signal.aborted) setError("Katalog belum dapat dimuat.");
      } finally {
        if (!c.signal.aborted) setLoading(false);
      }
    })();
    return () => c.abort();
  }, [existing, retry]);
  async function enroll() {
    if (!selected || !data.participant || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await supabase.rpc("direct_enroll_participant", {
        target_participant_id: data.participant.id,
        target_program_id: selected.id,
      });
      if (r.error) throw r.error;
      setMessage("Pendaftaran tersimpan. Status terbaru ada di Program saya.");
      setSelected(null);
      onEnrolled();
    } catch (e) {
      setError(
        (e as { message?: string })?.message ?? "Pendaftaran belum berhasil.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="student-catalog">
      <summary>
        <BookOpen size={18} />
        Jelajahi program<span>+</span>
      </summary>
      <div className="student-catalog-body">
        {message && (
          <p role="status" className="student-success">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="student-error">
            {error}{" "}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRetry((v) => v + 1)}
            >
              Coba lagi
            </Button>
          </p>
        )}
        {loading ? (
          <p role="status">Memuat katalog…</p>
        ) : !rows.length ? (
          <p className="student-muted">Belum ada program baru untuk diikuti.</p>
        ) : (
          <div className="student-catalog-grid">
            {rows.map((p) => {
              const form = forms.find((f) => f.program_id === p.id),
                direct = p.feature_flags?.use_direct_enrollment === true,
                state = getRegistrationWindowState(form);
              return (
                <article key={p.id}>
                  <small>{p.code}</small>
                  <h3>{p.name}</h3>
                  {p.description && <p>{p.description.slice(0, 180)}</p>}
                  <footer>
                    <Link to={"/katalog/" + p.id}>Detail program</Link>
                    {direct && data.participant?.status === "active" ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          setError("");
                          setSelected(p);
                        }}
                      >
                        Daftar
                        <ArrowRight size={14} />
                      </Button>
                    ) : state === "open" ? (
                      <Button asChild size="sm">
                        <Link to={"/learner/pendaftaran/" + p.id}>
                          Daftar
                          <ArrowRight size={14} />
                        </Link>
                      </Button>
                    ) : (
                      <span className="student-muted">
                        {state === "upcoming"
                          ? "Segera dibuka"
                          : "Pendaftaran belum dibuka"}
                      </span>
                    )}
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </div>
      {selected && (
        <Dialog
          title="Tinjau pendaftaran"
          busy={busy}
          onClose={() => setSelected(null)}
          className="student-enroll-dialog"
        >
          <h3>{selected.name}</h3>
          <p className="student-muted">
            {selected.feature_flags?.use_payment
              ? "Biaya mengikuti ketentuan program. Status pembayaran dapat diperiksa setelah pendaftaran."
              : "Daftarkan profil peserta Anda pada program ini."}
          </p>
          {error && (
            <p role="alert" className="student-error">
              {error}
            </p>
          )}
          <footer className="student-dialog-footer">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setSelected(null)}
            >
              Batal
            </Button>
            <Button onClick={() => void enroll()} disabled={busy}>
              {busy ? "Mendaftarkan…" : "Konfirmasi daftar"}
            </Button>
          </footer>
        </Dialog>
      )}
    </details>
  );
}
