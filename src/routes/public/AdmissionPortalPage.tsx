import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BookOpen, Upload, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardDescription } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { supabase } from "../../lib/supabase";

export function AdmissionPortalPage() {
  const { programId } = useParams();
  const navigate = useNavigate();

  const [program, setProgram] = useState<any>(null);
  const [formConfig, setFormConfig] = useState<any>(null);
  const [fields, setFields] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Standard fields
  const [standardData, setStandardData] = useState({
    full_name: "",
    email: "",
    phone: "",
    city: "",
    gender: "Laki-laki",
    birth_date: ""
  });

  // Custom fields answers
  const [customAnswers, setCustomAnswers] = useState<Record<string, any>>({});

  useEffect(() => {
    if (programId) loadData();
  }, [programId]);

  const loadData = async () => {
    setIsLoading(true);
    // Fetch program
    const { data: pData } = await supabase.from("programs").select("*").eq("id", programId).single();
    if (pData) setProgram(pData);

    // Fetch active form
    const { data: fData } = await supabase.from("registration_forms")
      .select("*")
      .eq("program_id", programId)
      .eq("status", "active")
      .single();

    if (fData) {
      setFormConfig(fData);
      const { data: fieldsData } = await supabase.from("registration_form_fields")
        .select("*")
        .eq("form_id", fData.id)
        .order("order_no");
      if (fieldsData) setFields(fieldsData);
    }
    setIsLoading(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, fieldKey: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // We store the File object temporarily, and upload it during submit to prevent unused files
    setCustomAnswers(prev => ({ ...prev, [fieldKey]: file }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // 1. Upload files first
      const uploadedPaths: Record<string, string> = {};
      
      for (const field of fields) {
        if (field.field_type === 'file') {
          const file = customAnswers[field.field_key];
          if (file instanceof File) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `applicants/${fileName}`;
            
            const { error: uploadError } = await supabase.storage
              .from('admission_documents')
              .upload(filePath, file);
              
            if (uploadError) throw new Error(`Gagal mengunggah file: ${file.name}`);
            uploadedPaths[field.field_key] = filePath;
          } else if (field.is_required && !file) {
            throw new Error(`File untuk ${field.label} wajib diunggah`);
          }
        }
      }

      // 2. Create Applicant
      const { data: applicant, error: appError } = await supabase.from("applicants").insert([{
        full_name: standardData.full_name,
        email: standardData.email,
        phone: standardData.phone,
        city: standardData.city,
        gender: standardData.gender,
        birth_date: standardData.birth_date || null,
        status: "submitted"
      }]).select().single();

      if (appError) throw appError;

      // 3. Create Program Choice
      const { error: choiceError } = await supabase.from("applicant_program_choices").insert([{
        applicant_id: applicant.id,
        program_id: programId
      }]);
      if (choiceError) throw choiceError;

      // 4. Submit Custom Answers
      if (fields.length > 0) {
        const answersToInsert = fields.map(f => {
          let val = customAnswers[f.field_key];
          if (f.field_type === 'file') {
            val = uploadedPaths[f.field_key] || "";
          }
          return {
            applicant_id: applicant.id,
            form_field_key: f.field_key,
            value_text: typeof val === 'string' ? val : null,
            value_json: typeof val === 'object' && f.field_type !== 'file' ? val : null
          };
        });
        const { error: ansError } = await supabase.from("applicant_answers").insert(answersToInsert);
        if (ansError) throw ansError;
      }

      setIsSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan saat memproses pendaftaran.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-pulse flex flex-col items-center"><BookOpen className="h-12 w-12 text-indigo-300 mb-4" /><p className="text-slate-500 font-medium">Memuat form pendaftaran...</p></div></div>;

  if (!program || !formConfig) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="max-w-md text-center shadow-xl border-0">
        <CardContent className="pt-10 pb-10">
          <AlertCircle className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Pendaftaran Ditutup</h2>
          <p className="text-slate-500 mb-6">Mohon maaf, program yang Anda tuju belum mengaktifkan pendaftaran atau form tidak ditemukan.</p>
          <Button onClick={() => navigate("/")} variant="outline">Kembali ke Beranda</Button>
        </CardContent>
      </Card>
    </div>
  );

  if (isSuccess) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-white p-4">
      <Card className="max-w-lg text-center shadow-2xl border-0">
        <div className="h-2 w-full bg-emerald-500"></div>
        <CardContent className="pt-10 pb-10">
          <CheckCircle2 className="h-20 w-20 text-emerald-500 mx-auto mb-6 animate-in zoom-in duration-500" />
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Pendaftaran Berhasil!</h2>
          <p className="text-slate-600 mb-8 leading-relaxed">
            Terima kasih, <strong>{standardData.full_name}</strong>. Pendaftaran Anda untuk program <strong>{program.name}</strong> telah kami terima dan akan segera ditinjau oleh tim admin.
          </p>
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-8 inline-block text-left">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Simpan Informasi Ini</p>
            <p className="text-sm font-medium text-slate-800">Email: {standardData.email}</p>
            <p className="text-sm font-medium text-slate-800">No. WA: {standardData.phone}</p>
          </div>
          <div>
            <Button onClick={() => navigate("/cek-status")} className="bg-indigo-600 hover:bg-indigo-700 w-full sm:w-auto">
              Cek Status Pendaftaran
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-indigo-100 text-indigo-600 mb-6 shadow-inner">
            <BookOpen className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{formConfig.title}</h1>
          <p className="mt-3 text-lg text-slate-600">{program.name}</p>
        </div>

        <Card className="shadow-xl border-slate-200 overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
          
          <CardHeader className="bg-white border-b border-slate-100 px-8 py-6">
            <CardDescription className="text-base text-slate-600 leading-relaxed whitespace-pre-wrap">
              {formConfig.description || "Silakan lengkapi formulir di bawah ini dengan data yang sebenar-benarnya."}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-0">
            <form onSubmit={handleSubmit} className="p-8 space-y-8">
              
              {errorMsg && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm font-medium flex gap-3 items-start">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <p>{errorMsg}</p>
                </div>
              )}

              {/* Data Diri Standar */}
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b">Data Diri Calon Peserta</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nama Lengkap Sesuai KTP <span className="text-rose-500">*</span></label>
                    <Input required placeholder="Misal: Ahmad Fulan" value={standardData.full_name} onChange={e => setStandardData({...standardData, full_name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Aktif <span className="text-rose-500">*</span></label>
                    <Input required type="email" placeholder="email@contoh.com" value={standardData.email} onChange={e => setStandardData({...standardData, email: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">No. WhatsApp <span className="text-rose-500">*</span></label>
                    <Input required type="tel" placeholder="0812xxxxxx" value={standardData.phone} onChange={e => setStandardData({...standardData, phone: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Jenis Kelamin <span className="text-rose-500">*</span></label>
                    <select required className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={standardData.gender} onChange={e => setStandardData({...standardData, gender: e.target.value})}>
                      <option value="Laki-laki">Laki-laki</option>
                      <option value="Perempuan">Perempuan</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tanggal Lahir</label>
                    <Input type="date" value={standardData.birth_date} onChange={e => setStandardData({...standardData, birth_date: e.target.value})} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Kota Domisili</label>
                    <Input placeholder="Misal: Jakarta Selatan" value={standardData.city} onChange={e => setStandardData({...standardData, city: e.target.value})} />
                  </div>
                </div>
              </div>

              {/* Custom Fields */}
              {fields.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b">Informasi Tambahan</h3>
                  <div className="space-y-5">
                    {fields.map(field => (
                      <div key={field.id}>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                          {field.label} {field.is_required && <span className="text-rose-500">*</span>}
                        </label>
                        
                        {field.field_type === 'text' && (
                          <Input 
                            required={field.is_required} 
                            value={customAnswers[field.field_key] || ""} 
                            onChange={e => setCustomAnswers({...customAnswers, [field.field_key]: e.target.value})} 
                          />
                        )}
                        
                        {field.field_type === 'textarea' && (
                          <textarea 
                            required={field.is_required}
                            className="w-full min-h-[100px] p-3 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                            value={customAnswers[field.field_key] || ""} 
                            onChange={e => setCustomAnswers({...customAnswers, [field.field_key]: e.target.value})} 
                          />
                        )}

                        {field.field_type === 'select' && (
                          <select 
                            required={field.is_required}
                            className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value={customAnswers[field.field_key] || ""} 
                            onChange={e => setCustomAnswers({...customAnswers, [field.field_key]: e.target.value})}
                          >
                            <option value="" disabled>-- Pilih --</option>
                            {(field.options_json || []).map((opt: string) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        )}

                        {field.field_type === 'file' && (
                          <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 bg-slate-50 hover:bg-slate-100 transition-colors text-center relative">
                            <input 
                              type="file" 
                              required={field.is_required}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              onChange={e => handleFileChange(e, field.field_key)}
                            />
                            <div className="pointer-events-none flex flex-col items-center gap-2">
                              {customAnswers[field.field_key] ? (
                                <>
                                  <div className="h-10 w-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
                                    <CheckCircle2 className="h-5 w-5" />
                                  </div>
                                  <span className="text-sm font-medium text-slate-800">{customAnswers[field.field_key].name}</span>
                                  <span className="text-xs text-slate-500">Klik untuk mengganti file</span>
                                </>
                              ) : (
                                <>
                                  <div className="h-10 w-10 bg-slate-200 text-slate-500 rounded-full flex items-center justify-center">
                                    <Upload className="h-5 w-5" />
                                  </div>
                                  <span className="text-sm font-medium text-slate-700">Pilih File atau Tarik ke Sini</span>
                                  <span className="text-xs text-slate-500">Maks. ukuran bervariasi</span>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-6 border-t">
                <Button type="submit" disabled={isSubmitting} className="w-full h-12 text-base font-bold shadow-lg bg-indigo-600 hover:bg-indigo-700">
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Memproses Pendaftaran...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Kirim Pendaftaran <Send className="h-4 w-4" />
                    </span>
                  )}
                </Button>
                <p className="text-center text-xs text-slate-400 mt-4">
                  Dengan mengirimkan pendaftaran, Anda menyetujui seluruh ketentuan program ini.
                </p>
              </div>

            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
