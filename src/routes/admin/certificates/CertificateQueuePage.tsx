import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "../../../lib/supabase";
import { ListIcon } from "lucide-react";

export function CertificateQueuePage() {
  const [batches, setBatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    const { data, error } = await supabase
      .from("certificate_issuance_batches")
      .select("*, programs(name), certificate_templates(name)")
      .order("created_at", { ascending: false });
    
    if (error) {
      setErrorMessage(error.message);
    } else {
      setBatches(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    void loadData();
    // In a real app we might set up a realtime subscription here to monitor the queue
  }, []);

  return (
    <div className="page-stack">
      <div className="mb-6">
        <h2 className="text-3xl font-bold tracking-tight">Antrean Penerbitan Syahadah</h2>
        <p className="text-muted-foreground mt-1">Pantau progres pembuatan syahadah di latar belakang.</p>
      </div>

      {errorMessage && (
        <Alert className="border-red-500 bg-red-50 text-red-900 mb-6">
          <AlertTitle>Gagal Memuat Data</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent"></div>
        </div>
      ) : batches.length === 0 ? (
        <div className="text-center p-16 border-2 border-dashed rounded-xl bg-muted/10">
          <ListIcon className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">Antrean Kosong</h3>
          <p className="text-muted-foreground mt-2">Belum ada proses penerbitan syahadah yang dijalankan.</p>
        </div>
      ) : (
        <Card className="border-border/50 shadow-sm overflow-hidden bg-white rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/80 border-b border-border/50 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-semibold">Tanggal</th>
                  <th className="px-6 py-4 font-semibold">Program</th>
                  <th className="px-6 py-4 font-semibold">Template</th>
                  <th className="px-6 py-4 font-semibold text-center">Total</th>
                  <th className="px-6 py-4 font-semibold text-center">Selesai</th>
                  <th className="px-6 py-4 font-semibold text-center">Gagal</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 bg-white">
                {batches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-primary/5 transition-colors">
                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                      {new Date(batch.created_at).toLocaleString("id-ID")}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {batch.programs?.name}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {batch.certificate_templates?.name}
                    </td>
                    <td className="px-6 py-4 text-center font-semibold">
                      {batch.total_jobs}
                    </td>
                    <td className="px-6 py-4 text-center font-semibold text-emerald-600">
                      {batch.completed_jobs}
                    </td>
                    <td className="px-6 py-4 text-center font-semibold text-red-600">
                      {batch.failed_jobs}
                    </td>
                    <td className="px-6 py-4">
                      {batch.status === "completed" ? (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 shadow-sm">Selesai</Badge>
                      ) : batch.status === "processing" ? (
                        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 shadow-sm">Memproses</Badge>
                      ) : (
                        <Badge variant="secondary" className="shadow-sm">Menunggu</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
