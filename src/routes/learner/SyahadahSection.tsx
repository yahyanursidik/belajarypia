import { useEffect, useState } from "react";
import { Download, FileBadge, RefreshCw } from "lucide-react";
import { Button } from "../../components/ui/button";
import { supabase } from "../../lib/supabase";
import { openCertificateDocument } from "../../lib/certificateData";
import type { IssuedCertificate } from "../../lib/certificateWorkspace";
export function SyahadahSection({ enrollmentId }: { enrollmentId: string }) {
  const [cert, setCert] = useState<Pick<
    IssuedCertificate,
    "id" | "certificate_number" | "object_key"
  > | null>(null);
  const [job, setJob] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setCert(null);
    setJob(null);
    setError("");
    setLoading(true);
    void (async () => {
      try {
        const [certificateResult, jobResult] = await Promise.all([
          supabase
            .from("certificates")
            .select("id,certificate_number,object_key")
            .eq("enrollment_id", enrollmentId)
            .eq("status", "issued")
            .order("issued_at", { ascending: false })
            .limit(1)
            .abortSignal(controller.signal)
            .maybeSingle(),
          supabase
            .from("certificate_generation_jobs")
            .select("status")
            .eq("enrollment_id", enrollmentId)
            .in("status", ["pending", "processing", "failed"])
            .order("created_at", { ascending: false })
            .limit(1)
            .abortSignal(controller.signal)
            .maybeSingle(),
        ]);
        if (controller.signal.aborted) return;
        if (certificateResult.error || jobResult.error) throw new Error();
        setCert(certificateResult.data);
        setJob(jobResult.data?.status ?? null);
      } catch {
        if (!controller.signal.aborted)
          setError("Status syahadah belum dapat dimuat.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [enrollmentId, retry]);
  async function download() {
    if (!cert) return;
    setDownloading(true);
    setError("");
    try {
      await openCertificateDocument(cert.id);
    } catch {
      setError("Dokumen belum dapat dibuka. Coba lagi.");
    } finally {
      setDownloading(false);
    }
  }
  return (
    <section className="program-panel space-y-3 mt-4">
      <div className="flex items-center gap-2">
        <FileBadge size={20} />
        <h3 className="font-semibold">Syahadah</h3>
      </div>
      {error && (
        <p role="alert" className="program-error">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status" className="text-sm">
          Memeriksa syahadah…
        </p>
      ) : cert ? (
        <>
          <p className="text-sm">{cert.certificate_number}</p>
          <Button
            disabled={downloading || !cert.object_key}
            onClick={() => void download()}
          >
            <Download size={15} />
            {downloading ? "Membuka…" : "Unduh syahadah"}
          </Button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {job === "failed"
            ? "Penerbitan perlu ditindaklanjuti admin."
            : job
              ? "Syahadah sedang dalam antrean penerbitan."
              : "Syahadah belum diterbitkan."}
        </p>
      )}
      <Button
        variant="ghost"
        size="sm"
        disabled={loading}
        onClick={() => setRetry((n) => n + 1)}
      >
        <RefreshCw size={14} />
        Perbarui status
      </Button>
    </section>
  );
}
