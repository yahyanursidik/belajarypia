import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "../../../lib/supabase";
import { CheckCircle, XCircle } from "lucide-react";

export function CertificateEligibilityPage() {
  const [programs, setPrograms] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  
  const [programId, setProgramId] = useState<string>("");
  const [batchId, setBatchId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("");

  const [eligible, setEligible] = useState<any[]>([]);
  const [notEligible, setNotEligible] = useState<any[]>([]);
  
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadPrograms() {
      const { data } = await supabase.from("programs").select("id, name").order("name");
      setPrograms(data || []);
      setLoadingPrograms(false);
    }
    loadPrograms();
  }, []);

  useEffect(() => {
    async function loadBatchesAndTemplates() {
      if (!programId) {
        setBatches([]);
        setTemplates([]);
        return;
      }
      const [{ data: bData }, { data: tData }] = await Promise.all([
        supabase.from("batches").select("id, name").eq("program_id", programId).order("name"),
        supabase.from("certificate_templates").select("id, name").eq("program_id", programId).order("name")
      ]);
      setBatches(bData || []);
      setTemplates(tData || []);
      setBatchId("");
      setTemplateId("");
      setEligible([]);
      setNotEligible([]);
    }
    loadBatchesAndTemplates();
  }, [programId]);

  const checkEligibility = async () => {
    if (!programId) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("check-certificate-eligibility", {
        body: { program_id: programId, batch_id: batchId || null }
      });
      if (error) throw error;
      setEligible(data.eligible || []);
      setNotEligible(data.notEligible || []);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
    setLoading(false);
  };

  const createBatch = async () => {
    if (!programId || !templateId || eligible.length === 0) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const { error } = await supabase.functions.invoke("create-certificate-issuance-batch", {
        body: { 
          program_id: programId, 
          batch_id: batchId || null, 
          template_id: templateId, 
          enrollments: eligible.map(e => ({ enrollment_id: e.id, participant_id: e.participant_id })) 
        }
      });
      if (error) throw error;
      setSuccessMsg("Antrean berhasil dibuat! Proses akan berjalan di latar belakang.");
      setEligible([]);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="page-stack">
      <div className="mb-6">
        <h2 className="text-3xl font-bold tracking-tight">Cek Kelayakan Syahadah</h2>
        <p className="text-muted-foreground mt-1">Evaluasi kelayakan peserta sebelum menerbitkan syahadah.</p>
      </div>

      {errorMsg && (
        <Alert className="border-red-500 bg-red-50 text-red-900 mb-6">
          <AlertTitle>Gagal</AlertTitle>
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {successMsg && (
        <Alert className="border-emerald-500 bg-emerald-50 text-emerald-900 mb-6">
          <AlertTitle>Berhasil</AlertTitle>
          <AlertDescription>{successMsg}</AlertDescription>
        </Alert>
      )}

      <Card className="border-border/50 shadow-sm mb-8">
        <CardHeader>
          <CardTitle>Filter Peserta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="space-y-2 flex-1">
              <label className="text-sm font-semibold">Pilih Program</label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={programId}
                onChange={(e) => setProgramId(e.target.value)}
                disabled={loadingPrograms || loading}
              >
                <option value="">-- Pilih Program --</option>
                {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            
            <div className="space-y-2 flex-1">
              <label className="text-sm font-semibold">Pilih Batch (Opsional)</label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                disabled={!programId || loading}
              >
                <option value="">Semua Batch</option>
                {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            <Button onClick={checkEligibility} disabled={!programId || loading} className="h-10">
              {loading ? "Memproses..." : "Cek Kelayakan"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {eligible.length > 0 && (
        <Card className="border-emerald-200 shadow-sm mb-8">
          <CardHeader className="bg-emerald-50/50 border-b border-emerald-100">
            <div className="flex justify-between items-center">
              <CardTitle className="text-emerald-800 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Peserta Eligible ({eligible.length})
              </CardTitle>
              <div className="flex items-center gap-3">
                <select 
                  className="flex h-9 w-64 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                >
                  <option value="">-- Pilih Template --</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <Button onClick={createBatch} disabled={!templateId || loading} className="bg-emerald-600 hover:bg-emerald-700">
                  Buat Antrean Syahadah
                </Button>
              </div>
            </div>
          </CardHeader>
          <div className="overflow-x-auto max-h-[400px]">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 sticky top-0 border-b">
                <tr>
                  <th className="px-6 py-3 font-semibold">Nama Peserta</th>
                  <th className="px-6 py-3 font-semibold">Nomor Registrasi</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {eligible.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 font-medium">{e.participants?.display_name}</td>
                    <td className="px-6 py-3 font-mono text-xs">{e.participants?.global_participant_number || "-"}</td>
                    <td className="px-6 py-3">
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">{e.enrollment_status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {notEligible.length > 0 && (
        <Card className="border-red-200 shadow-sm">
          <CardHeader className="bg-red-50/50 border-b border-red-100">
            <CardTitle className="text-red-800 flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              Belum Eligible ({notEligible.length})
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto max-h-[400px]">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 sticky top-0 border-b">
                <tr>
                  <th className="px-6 py-3 font-semibold">Nama Peserta</th>
                  <th className="px-6 py-3 font-semibold">Alasan</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {notEligible.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 font-medium">{e.participants?.display_name}</td>
                    <td className="px-6 py-3">
                      <Badge variant="destructive" className="font-normal">{e.reason}</Badge>
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
