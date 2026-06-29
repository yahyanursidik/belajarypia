import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FileBadge, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";

export function SyahadahSection({ enrollmentId }: { enrollmentId: string }) {
  const [cert, setCert] = useState<any>(null);
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    async function fetchSyahadah() {
      // Check certificate first
      const { data: certData } = await supabase
        .from("certificates")
        .select("*")
        .eq("enrollment_id", enrollmentId)
        .maybeSingle();

      if (certData) {
        setCert(certData);
      } else {
        // Check queue
        const { data: jobData } = await supabase
          .from("certificate_generation_jobs")
          .select("*")
          .eq("enrollment_id", enrollmentId)
          .in("status", ["pending", "processing"])
          .maybeSingle();
          
        if (jobData) {
          setJob(jobData);
        }
      }
      setLoading(false);
    }
    fetchSyahadah();
  }, [enrollmentId]);

  const handleDownload = async () => {
    if (!cert) return;
    setDownloading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-certificate-download-url", {
        body: { certificate_id: cert.id }
      });
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (err: any) {
      alert("Gagal mengunduh: " + err.message);
    }
    setDownloading(false);
  };

  if (loading) return <div className="text-sm text-gray-500">Memeriksa status Syahadah...</div>;

  if (cert) {
    return (
      <Alert className="mt-4 bg-green-50 border-green-200">
        <FileBadge className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-800">Syahadah Tersedia</AlertTitle>
        <AlertDescription className="text-green-700 mt-2 flex flex-col items-start gap-3">
          <div>
            <p><strong>Nomor:</strong> {cert.certificate_number}</p>
            <p><strong>Tanggal Terbit:</strong> {new Date(cert.issued_at).toLocaleDateString("id-ID")}</p>
          </div>
          <Button onClick={handleDownload} disabled={downloading} size="sm" className="bg-green-600 hover:bg-green-700 text-white">
            {downloading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Download Syahadah
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (job) {
    return (
      <Alert className="mt-4 bg-yellow-50 border-yellow-200">
        <AlertTitle className="text-yellow-800">Syahadah Sedang Diproses</AlertTitle>
        <AlertDescription className="text-yellow-700">
          Status: Dalam Antrean<br/>
          Estimasi: Akan diterbitkan bertahap oleh sistem.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="mt-4 bg-gray-50">
      <AlertTitle>Syahadah Belum Tersedia</AlertTitle>
      <AlertDescription className="text-gray-500 text-sm">
        Syahadah akan tersedia setelah program selesai dan kelayakan terpenuhi.
      </AlertDescription>
    </Alert>
  );
}
