import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BookOpen, Upload, Send, CheckCircle2, AlertCircle, ChevronLeft, Trash2, Loader2, FileText, Check } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardDescription } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { supabase } from "../../lib/supabase";
import { useAuthSession } from "../../app/providers/authSessionContext";

function FormSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-8 animate-pulse">
        <div className="flex flex-col items-center">
          <div className="h-16 w-16 bg-slate-200 rounded-2xl mb-6"></div>
          <div className="h-8 w-64 bg-slate-200 rounded mb-3"></div>
          <div className="h-5 w-40 bg-slate-200 rounded"></div>
        </div>
        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="h-2 bg-slate-200"></div>
          <div className="p-8 space-y-6">
            <div className="h-6 w-40 bg-slate-300 rounded mb-4"></div>
            <div className="space-y-4">
              <div className="h-10 bg-slate-100 rounded"></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="h-10 bg-slate-100 rounded"></div>
                <div className="h-10 bg-slate-100 rounded"></div>
              </div>
              <div className="h-10 bg-slate-100 rounded"></div>
            </div>
            <div className="h-12 bg-slate-200 rounded mt-6"></div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export function AdmissionPortalPage() {
  const { programId } = useParams();
  const navigate = useNavigate();
  const { session } = useAuthSession();

  const [program, setProgram] = useState<any>(null);
  const [formConfig, setFormConfig] = useState<any>(null);
  const [fields, setFields] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Verification states
  const [alreadyEnrolled, setAlreadyEnrolled] = useState(false);
  const [enrollmentStatus, setEnrollmentStatus] = useState("");
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [existingAppStatus, setExistingAppStatus] = useState("");

  // File states
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const [dragActive, setDragActive] = useState<Record<string, boolean>>({});

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
  }, [programId, session?.user?.id]);

  const loadData = async () => {
    setIsLoading(true);
    setAlreadyEnrolled(false);
    setAlreadyApplied(false);
    setErrorMsg(null);

    // Fetch program
    const { data: pData } = await supabase.from("programs").select("*").eq("id", programId).single();
    if (pData) setProgram(pData);

    // Fetch active form
    const { data: fData } = await supabase.from("registration_forms")
      .select("*")
      .eq("program_id", programId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fData) {
      setFormConfig(fData);
      const { data: fieldsData } = await supabase.from("registration_form_fields")
        .select("*")
        .eq("form_id", fData.id)
        .order("order_no");
      if (fieldsData) setFields(fieldsData);
    }

    // Fetch user details if session exists
    const sessionResponse = await supabase.auth.getSession();
    const currentSession = sessionResponse.data.session;
    
    if (currentSession?.user?.id) {
      try {
        const { data: profileData } = await supabase
          .from("profiles")
          .select(`
            full_name,
            email,
            phone,
            participant:participants (
              id,
              gender,
              birth_date,
              city
            )
          `)
          .eq("id", currentSession.user.id)
          .maybeSingle();

        if (profileData) {
          const participantObj = Array.isArray(profileData.participant) 
            ? profileData.participant[0] 
            : profileData.participant;
            
          setStandardData({
            full_name: profileData.full_name || "",
            email: profileData.email || currentSession.user.email || "",
            phone: profileData.phone || "",
            city: participantObj?.city || "",
            gender: participantObj?.gender || "",
            birth_date: participantObj?.birth_date || ""
          });

          // Check enrollment and application status securely using RPC (bypasses direct table RLS restrictions)
          const userEmail = profileData.email || currentSession.user.email;
          const { data: regCheck, error: checkError } = await supabase.rpc("check_user_program_registration", {
            p_user_id: currentSession.user.id,
            p_email: userEmail || null,
            p_program_id: programId
          });

          if (checkError) {
            console.error("Error executing check_user_program_registration RPC:", checkError);
          } else if (regCheck && regCheck.length > 0) {
            const result = regCheck[0];
            if (result.already_enrolled) {
              setAlreadyEnrolled(true);
              setEnrollmentStatus(result.enrollment_status);
            } else if (result.already_applied) {
              setAlreadyApplied(true);
              setExistingAppStatus(result.application_status);
            }
          }
        }
      } catch (err) {
        console.error("Error fetching user data in loadData:", err);
      }
    }

    setIsLoading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fieldKey: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: 10MB
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setFileErrors(prev => ({ ...prev, [fieldKey]: "Ukuran file maksimal adalah 10MB" }));
      return;
    }

    setFileErrors(prev => {
      const copy = { ...prev };
      delete copy[fieldKey];
      return copy;
    });

    setCustomAnswers(prev => ({ ...prev, [fieldKey]: file }));
  };

  const handleDrag = (e: React.DragEvent, fieldKey: string, active: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(prev => ({ ...prev, [fieldKey]: active }));
  };

  const handleDrop = (e: React.DragEvent, fieldKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(prev => ({ ...prev, [fieldKey]: false }));

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setFileErrors(prev => ({ ...prev, [fieldKey]: "Ukuran file maksimal adalah 10MB" }));
      return;
    }

    setFileErrors(prev => {
      const copy = { ...prev };
      delete copy[fieldKey];
      return copy;
    });

    setCustomAnswers(prev => ({ ...prev, [fieldKey]: file }));
  };

  const removeFile = (fieldKey: string) => {
    setCustomAnswers(prev => {
      const copy = { ...prev };
      delete copy[fieldKey];
      return copy;
    });
    setFileErrors(prev => {
      const copy = { ...prev };
      delete copy[fieldKey];
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Final file checks
    if (Object.keys(fileErrors).length > 0) {
      setErrorMsg("Harap perbaiki kesalahan file sebelum mengirimkan formulir.");
      return;
    }

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
        gender: standardData.gender || null,
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

  const isLearnerPortal = window.location.pathname.startsWith('/learner');

  if (isLoading) return <FormSkeleton />;

  if (!program || !formConfig) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="max-w-md text-center shadow-xl border-0">
        <CardContent className="pt-10 pb-10">
          <AlertCircle className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Pendaftaran Ditutup</h2>
          <p className="text-slate-500 mb-6">Mohon maaf, program yang Anda tuju belum mengaktifkan pendaftaran atau form tidak ditemukan.</p>
          <Button onClick={() => navigate(isLearnerPortal ? "/learner" : "/")} variant="outline">Kembali ke Beranda</Button>
        </CardContent>
      </Card>
    </div>
  );

  if (isSuccess) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-white p-4">
      <Card className="max-w-lg text-center shadow-2xl border-0">
        <div className="h-2 w-full bg-emerald-500"></div>
        <CardContent className="pt-10 pb-10 px-6 sm:px-10">
          <CheckCircle2 className="h-20 w-20 text-emerald-500 mx-auto mb-6 animate-in zoom-in duration-500" />
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Pendaftaran Berhasil!</h2>
          <p className="text-slate-600 mb-8 leading-relaxed">
            Terima kasih, <strong>{standardData.full_name}</strong>. Pendaftaran Anda untuk program <strong>{program.name}</strong> telah kami terima dan akan segera ditinjau oleh tim admin.
          </p>

          {/* Group Invitation Link Section */}
          {formConfig?.group_settings && formConfig.group_settings.platform !== "none" && (
            <div className="mb-8 border border-primary/10 rounded-2xl bg-primary/5 overflow-hidden text-left animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-primary/10 px-6 py-4 border-b border-primary/10">
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <span>Bergabung dengan Grup {formConfig.group_settings.platform === 'whatsapp' ? 'WhatsApp' : 'Telegram'}</span>
                </h4>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Klik / akses tautan di bawah ini untuk bergabung dengan grup {formConfig.group_settings.platform === 'whatsapp' ? 'WhatsApp' : 'Telegram'}. Silakan bergabung ke grup komunitas untuk mendapatkan informasi selanjutnya.
                </p>
              </div>
              <div className="p-6 flex flex-col gap-3">
                {(() => {
                  const settings = formConfig.group_settings!;
                  let groups: { name: string; link: string }[] = [];
                  
                  if (settings.separated_gender) {
                    const lowerGender = (standardData.gender || "").toLowerCase();
                    if (lowerGender === "laki-laki" || lowerGender === "male") {
                      groups = settings.ikhwan_groups || [];
                    } else if (lowerGender === "perempuan" || lowerGender === "female") {
                      groups = settings.akhwat_groups || [];
                    }
                  } else {
                    groups = settings.general_groups || [];
                  }

                  if (groups.length === 0) {
                    return <p className="text-sm text-slate-500">Tautan grup belum tersedia.</p>;
                  }

                  return groups.map((g, idx) => (
                    <Button key={idx} asChild variant="outline" className="w-full justify-start text-left h-auto py-3.5 border-primary/20 hover:border-primary hover:bg-primary/5 bg-white">
                      <a href={g.link} target="_blank" rel="noopener noreferrer">
                        <span className="font-semibold text-primary">{g.name || `Grup ${idx + 1}`}</span>
                      </a>
                    </Button>
                  ));
                })()}
              </div>
            </div>
          )}

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-8 inline-block text-left w-full">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Simpan Informasi Ini</p>
            <p className="text-sm font-medium text-slate-800">Email: {standardData.email}</p>
            <p className="text-sm font-medium text-slate-800">No. WA: {standardData.phone}</p>
          </div>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            {isLearnerPortal && (
              <Button onClick={() => navigate("/learner/cek-status")} variant="outline" className="border-primary/20 text-primary hover:bg-primary/5 w-full sm:w-auto">
                Cek Status Pendaftaran
              </Button>
            )}
            <Button onClick={() => navigate(isLearnerPortal ? "/learner" : "/cek-status")} className="bg-primary hover:bg-primary/90 w-full sm:w-auto text-white font-bold">
              {isLearnerPortal ? "Kembali ke Dashboard" : "Cek Status Pendaftaran"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Back Navigation Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
          <Button 
            onClick={() => navigate(isLearnerPortal ? "/learner" : "/")} 
            variant="ghost" 
            size="sm" 
            className="text-slate-600 hover:text-slate-900 transition-colors font-medium flex items-center gap-1.5"
          >
            <ChevronLeft className="h-4 w-4" /> Kembali
          </Button>
          {session && (
            <span className="text-xs text-primary font-semibold uppercase tracking-wider bg-primary/10 px-2.5 py-1 rounded">Portal Peserta</span>
          )}
        </div>

        <div className="text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 text-primary mb-6 shadow-inner">
            <BookOpen className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{formConfig.title}</h1>
          <p className="mt-3 text-lg text-slate-600">{program.name}</p>
        </div>

        {/* Guard for Already Enrolled */}
        {alreadyEnrolled ? (
          <Card className="shadow-lg border-emerald-100 overflow-hidden">
            <div className="h-2 bg-emerald-500"></div>
            <CardContent className="p-8 text-center space-y-6">
              <div className="h-16 w-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <Check className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-800">Anda Sudah Terdaftar</h3>
                <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed">
                  Anda telah terdaftar secara aktif dalam program <strong>{program.name}</strong> dengan status kelas/angkatan <strong>{enrollmentStatus}</strong>.
                </p>
              </div>
              <div className="pt-2">
                <Button onClick={() => navigate(isLearnerPortal ? "/learner" : "/")} className="bg-primary hover:bg-primary/90 text-white font-bold">
                  Kembali ke Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : alreadyApplied ? (
          /* Guard for Already Applied */
          <Card className="shadow-lg border-amber-100 overflow-hidden">
            <div className="h-2 bg-amber-500"></div>
            <CardContent className="p-8 text-center space-y-6">
              <div className="h-16 w-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto shadow-inner animate-pulse">
                <FileText className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-800">Pendaftaran Sedang Ditinjau</h3>
                <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed">
                  Anda sudah mengirimkan formulir pendaftaran untuk program ini. Pendaftaran Anda saat ini berstatus <strong>{existingAppStatus}</strong>.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
                <Button onClick={() => navigate(isLearnerPortal ? "/learner/cek-status" : "/cek-status")} variant="outline" className="border-primary/20 text-primary hover:bg-primary/5">
                  Cek Status Pendaftaran
                </Button>
                <Button onClick={() => navigate(isLearnerPortal ? "/learner" : "/")} className="bg-primary hover:bg-primary/90 text-white font-bold">
                  Kembali ke Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Main Form Card */
          <Card className="shadow-xl border-slate-200 overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-primary via-purple-500 to-pink-500"></div>
            
            <CardHeader className="bg-white border-b border-slate-100 px-8 py-6">
              <CardDescription className="text-base text-slate-600 leading-relaxed whitespace-pre-wrap">
                {formConfig.description || "Silakan lengkapi formulir di bawah ini dengan data yang sebenar-benarnya."}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="p-0">
              <form onSubmit={handleSubmit} className="p-8 space-y-8">
                
                {errorMsg && (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm font-medium flex gap-3 items-start animate-in shake">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <p>{errorMsg}</p>
                  </div>
                )}

                {/* Data Diri Standar */}
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-4 pb-2 border-b">Data Diri Calon Peserta</h3>
                  
                  {/* Account Info Summary for Logged-in Users */}
                  {session && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 className="h-5 w-5 text-primary animate-in zoom-in" />
                        <h4 className="text-sm font-bold text-slate-800">Mendaftar dengan Akun Terhubung</h4>
                      </div>
                      <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                        Anda sedang masuk ke sistem. Data pendaftaran akan otomatis terhubung dengan profil Anda di bawah ini:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
                        <div>
                          <span className="text-xs text-slate-400 block mb-0.5">Nama Lengkap</span>
                          <span className="font-semibold text-slate-800">{standardData.full_name || <span className="text-rose-500 font-normal italic text-xs">Belum diatur</span>}</span>
                        </div>
                        <div>
                          <span className="text-xs text-slate-400 block mb-0.5">Email</span>
                          <span className="font-semibold text-slate-800">{standardData.email || <span className="text-rose-500 font-normal italic text-xs">Belum diatur</span>}</span>
                        </div>
                        <div>
                          <span className="text-xs text-slate-400 block mb-0.5">No. WhatsApp / Telepon</span>
                          <span className="font-semibold text-slate-800">{standardData.phone || <span className="text-rose-500 font-normal italic text-xs">Belum diatur</span>}</span>
                        </div>
                        <div>
                          <span className="text-xs text-slate-400 block mb-0.5">Jenis Kelamin</span>
                          <span className="font-semibold text-slate-800">{standardData.gender || <span className="text-rose-500 font-normal italic text-xs">Belum diatur</span>}</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-primary mt-3 font-medium">
                        * Data profil di atas dapat diperbarui melalui halaman Profil Saya di Dashboard.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {(!session || !standardData.full_name) && (
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nama Lengkap Sesuai KTP <span className="text-rose-500">*</span></label>
                        <Input required placeholder="Misal: Ahmad Fulan" value={standardData.full_name} onChange={e => setStandardData({...standardData, full_name: e.target.value})} />
                      </div>
                    )}
                    {(!session || !standardData.email) && (
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Aktif <span className="text-rose-500">*</span></label>
                        <Input required type="email" placeholder="email@contoh.com" value={standardData.email} onChange={e => setStandardData({...standardData, email: e.target.value})} />
                      </div>
                    )}
                    {(!session || !standardData.phone) && (
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">No. WhatsApp <span className="text-rose-500">*</span></label>
                        <Input required type="tel" placeholder="0812xxxxxx" value={standardData.phone} onChange={e => setStandardData({...standardData, phone: e.target.value})} />
                      </div>
                    )}
                    {(!session || !standardData.gender) && (
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Jenis Kelamin <span className="text-rose-500">*</span></label>
                        <select required className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" value={standardData.gender} onChange={e => setStandardData({...standardData, gender: e.target.value})}>
                          <option value="" disabled>Pilih Jenis Kelamin</option>
                          <option value="Laki-laki">Laki-laki</option>
                          <option value="Perempuan">Perempuan</option>
                        </select>
                      </div>
                    )}
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
                        <div key={field.id} className="animate-in fade-in duration-300">
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
                              className="w-full min-h-[100px] p-3 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                              value={customAnswers[field.field_key] || ""} 
                              onChange={e => setCustomAnswers({...customAnswers, [field.field_key]: e.target.value})} 
                            />
                          )}

                          {field.field_type === 'select' && (
                            <select 
                              required={field.is_required}
                              className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
                            <div className="space-y-1.5">
                              <div 
                                className={`border-2 border-dashed rounded-xl p-6 transition-all text-center relative ${
                                  dragActive[field.field_key] 
                                    ? 'border-primary bg-primary/5' 
                                    : customAnswers[field.field_key]
                                      ? 'border-emerald-200 bg-emerald-50/10'
                                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                                }`}
                                onDragOver={e => handleDrag(e, field.field_key, true)}
                                onDragLeave={e => handleDrag(e, field.field_key, false)}
                                onDrop={e => handleDrop(e, field.field_key)}
                              >
                                <input 
                                  type="file" 
                                  required={field.is_required && !customAnswers[field.field_key]}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                  onChange={e => handleFileChange(e, field.field_key)}
                                />
                                <div className="pointer-events-none flex flex-col items-center gap-2">
                                  {customAnswers[field.field_key] ? (
                                    <>
                                      <div className="h-12 w-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center animate-in zoom-in">
                                        <CheckCircle2 className="h-6 w-6" />
                                      </div>
                                      <span className="text-sm font-semibold text-slate-800 break-all max-w-[280px]">
                                        {customAnswers[field.field_key] instanceof File 
                                          ? customAnswers[field.field_key].name 
                                          : "File terunggah"
                                        }
                                      </span>
                                      <span className="text-xs text-slate-400">Klik / seret file untuk mengganti</span>
                                    </>
                                  ) : (
                                    <>
                                      <div className="h-12 w-12 bg-slate-200 text-slate-500 rounded-full flex items-center justify-center transition-colors">
                                        <Upload className="h-5 w-5" />
                                      </div>
                                      <span className="text-sm font-medium text-slate-700">Pilih File atau Tarik ke Sini</span>
                                      <span className="text-xs text-slate-400">Ukuran maksimal file: 10MB</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Upload control tools if file exists */}
                              {customAnswers[field.field_key] && (
                                <div className="flex justify-end">
                                  <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => removeFile(field.field_key)}
                                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 flex items-center gap-1.5 h-8 px-2.5 rounded-lg"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" /> Hapus File
                                  </Button>
                                </div>
                              )}

                              {fileErrors[field.field_key] && (
                                <p className="text-xs font-semibold text-rose-600 mt-1 flex items-center gap-1 animate-in slide-in-from-top-1">
                                  <AlertCircle className="h-3 w-3 shrink-0" /> {fileErrors[field.field_key]}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-6 border-t">
                  <Button type="submit" disabled={isSubmitting} className="w-full h-12 text-base font-bold shadow-lg bg-primary hover:bg-primary/90 text-white font-bold transition-colors">
                    {isSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Memproses Pendaftaran...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        Kirim Pendaftaran <Send className="h-4 w-4" />
                      </span>
                    )}
                  </Button>
                  <p className="text-center text-xs text-slate-400 mt-4 leading-normal">
                    Dengan mengirimkan pendaftaran, Anda menyetujui seluruh ketentuan program ini.
                  </p>
                </div>

              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
