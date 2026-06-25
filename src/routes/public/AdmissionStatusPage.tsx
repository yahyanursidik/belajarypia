import { useState } from "react";
import { Search, Activity, User, BookOpen, AlertCircle } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { supabase } from "../../lib/supabase";
import { applicantStatusLabels } from "../../lib/admission";

export function AdmissionStatusPage() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [applicantInfo, setApplicantInfo] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setSearched(false);
    setApplicantInfo(null);

    try {
      // Because this is a public page, we query without RLS using a direct lookup
      // Wait, RLS on applicants prevents anon from reading.
      // So anon CANNOT select from applicants.
      // We must use a security definer RPC to fetch limited status info.
      
      const { data, error } = await supabase.rpc("check_applicant_status", {
        p_email: email,
        p_phone: phone
      });

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        setApplicantInfo(data[0]); // assume latest or single application
      } else {
        setApplicantInfo(null);
      }
      setSearched(true);
    } catch (err: any) {
      setErrorMsg("Terjadi kesalahan sistem. Coba beberapa saat lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'rejected': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'revision_requested': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-xl w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-indigo-100 text-indigo-600 mb-6 shadow-inner">
            <Activity className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Cek Status Pendaftaran</h1>
          <p className="mt-3 text-base text-slate-600">Pantau perkembangan status penerimaan Anda cukup dengan Email dan Nomor WhatsApp yang didaftarkan.</p>
        </div>

        <Card className="shadow-xl border-slate-200 overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
          <CardContent className="p-8">
            <form onSubmit={handleSearch} className="space-y-5 mb-8">
              {errorMsg && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm font-medium flex gap-3 items-start">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <p>{errorMsg}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Terdaftar</label>
                <Input required type="email" placeholder="Misal: fulan@contoh.com" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nomor WhatsApp Terdaftar</label>
                <Input required type="tel" placeholder="Misal: 0812xxxxxx" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <Button type="submit" disabled={isLoading} className="w-full h-11 text-base font-bold bg-indigo-600 hover:bg-indigo-700">
                {isLoading ? "Mencari..." : <span className="flex items-center gap-2"><Search className="h-4 w-4"/> Cari Pendaftaran</span>}
              </Button>
            </form>

            {searched && (
              <div className="pt-6 border-t animate-in zoom-in-95 duration-300">
                {applicantInfo ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 text-center">Hasil Pencarian</h3>
                    
                    <div className="flex flex-col items-center gap-2 mb-6">
                      <div className="h-14 w-14 rounded-full bg-white border flex items-center justify-center text-indigo-600 font-bold text-xl mb-1 shadow-sm">
                        {applicantInfo.full_name.charAt(0)}
                      </div>
                      <p className="font-bold text-slate-900 text-lg">{applicantInfo.full_name}</p>
                    </div>

                    <div className="space-y-3 bg-white p-4 rounded-lg border border-slate-100">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 flex items-center gap-2"><BookOpen className="h-4 w-4"/> Program</span>
                        <span className="font-semibold text-slate-800 text-right">{applicantInfo.program_name}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 flex items-center gap-2"><Activity className="h-4 w-4"/> Status</span>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border uppercase tracking-wide ${getStatusColor(applicantInfo.status)}`}>
                          {(applicantStatusLabels as any)[applicantInfo.status] || applicantInfo.status}
                        </span>
                      </div>
                    </div>

                    {applicantInfo.status === 'accepted' && (
                      <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm text-center">
                        <p className="font-bold mb-1">Selamat! Pendaftaran Anda Diterima.</p>
                        <p>Tim kami akan segera menghubungi Anda untuk langkah selanjutnya atau pembagian kelas.</p>
                      </div>
                    )}
                    
                    {applicantInfo.status === 'revision_requested' && (
                      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm text-center">
                        <p className="font-bold mb-1">Butuh Perbaikan Dokumen!</p>
                        <p>Tim admin meminta Anda untuk memperbaiki atau melengkapi data/dokumen. Silakan cek email/WhatsApp Anda untuk instruksi lebih lanjut.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center p-6 bg-slate-50 border border-dashed border-slate-300 rounded-xl">
                    <User className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <p className="font-semibold text-slate-700">Pendaftaran Tidak Ditemukan</p>
                    <p className="text-sm text-slate-500 mt-1">Pastikan Email dan Nomor WhatsApp yang dimasukkan sama persis dengan saat Anda mendaftar.</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
