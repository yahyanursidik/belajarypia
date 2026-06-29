import { useEffect, useState } from "react";
import { fetchTranscriptData, type TranscriptData } from "../lib/transcript";
import { fetchSystemSettings, emptySettings, type SystemSettings } from "../lib/settings";
import { Button } from "./ui/button";
import { Printer, ArrowLeft, Layers, History } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

interface TranscriptViewProps {
  enrollmentId: string;
  onBack?: () => void;
}

export function TranscriptView({ enrollmentId, onBack }: TranscriptViewProps) {
  const [data, setData] = useState<TranscriptData | null>(null);
  const [settings, setSettings] = useState<SystemSettings>(emptySettings);
  const [isLoading, setIsLoading] = useState(true);
  const [activeEnrollmentId, setActiveEnrollmentId] = useState(enrollmentId);
  const [otherPrograms, setOtherPrograms] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const [res, sysSettings] = await Promise.all([
        fetchTranscriptData(activeEnrollmentId),
        fetchSystemSettings()
      ]);
      setData(res);
      setSettings(sysSettings || emptySettings);
      
      // Fetch other enrollments for this participant if not already fetched
      if (res && res.enrollment && otherPrograms.length === 0) {
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('id, enrollment_status, programs(name), classes(name)')
          .eq('participant_id', res.enrollment.participant_id)
          .order('created_at', { ascending: false });
        
        if (enrollments) {
          setOtherPrograms(enrollments);
        }
      }
      
      setIsLoading(false);
    }
    load();
  }, [activeEnrollmentId]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <div className="h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-slate-500 font-medium animate-pulse">Memuat transkrip...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-12 text-center">
        <p className="text-red-500 font-semibold text-lg">Gagal memuat transkrip atau data tidak ditemukan.</p>
        <Button variant="outline" className="mt-4" onClick={() => onBack ? onBack() : navigate(-1)}>
          Kembali
        </Button>
      </div>
    );
  }

  const { enrollment, modules, lessons, progress, finalGrade, predicate } = data;
  const participantName = enrollment.participants?.display_name || "-";
  const participantNumber = enrollment.participants?.global_participant_number || "-";
  const programName = (enrollment as any).programs?.name || "-";
  const className = (enrollment as any).classes?.name || "-";

  return (
    <div className="min-h-screen bg-slate-50/50 relative overflow-hidden flex flex-col py-12 print:py-0 print:bg-white">
      {/* Decorative Background - Hidden in print */}
      <div className="absolute top-0 inset-x-0 h-full w-full overflow-hidden pointer-events-none print:hidden z-0">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl opacity-70 animate-pulse mix-blend-multiply duration-[10000ms]"></div>
        <div className="absolute top-80 -left-20 w-72 h-72 bg-emerald-400/20 rounded-full blur-3xl opacity-70 animate-pulse mix-blend-multiply duration-[8000ms] delay-700"></div>
        <div className="absolute bottom-40 right-20 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl opacity-50 animate-pulse mix-blend-multiply duration-[12000ms] delay-1000"></div>
      </div>

      {/* Program Switcher Sidebar (Desktop) - Hidden in print */}
      {otherPrograms.length > 1 && (
        <div className="hidden xl:block fixed right-8 top-1/2 -translate-y-1/2 w-72 bg-white/80 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/50 p-5 print:hidden z-40 animate-in slide-in-from-right-8 duration-700">
          <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4 text-sm border-b pb-3">
            <Layers className="h-4 w-4 text-indigo-500" />
            Riwayat Program Peserta
          </h3>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {otherPrograms.map(prog => {
              const isActive = prog.id === activeEnrollmentId;
              return (
                <button
                  key={prog.id}
                  onClick={() => setActiveEnrollmentId(prog.id)}
                  disabled={isActive}
                  className={`w-full text-left p-3 rounded-xl transition-all duration-300 text-sm border ${
                    isActive 
                      ? 'bg-indigo-600 border-indigo-600 shadow-md transform scale-[1.02]' 
                      : 'bg-white/50 border-slate-200 hover:bg-slate-50 hover:border-indigo-300 hover:shadow-sm'
                  }`}
                >
                  <p className={`font-bold leading-tight ${isActive ? 'text-white' : 'text-slate-800'}`}>
                    {prog.programs?.name || "Program"}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      isActive ? 'bg-white/20 text-white' : 
                      prog.enrollment_status === 'completed' ? 'bg-blue-100 text-blue-700' :
                      prog.enrollment_status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {prog.enrollment_status === 'active' ? 'Aktif' : prog.enrollment_status === 'completed' ? 'Selesai' : prog.enrollment_status}
                    </span>
                    <span className={`text-[11px] font-medium ${isActive ? 'text-indigo-100' : 'text-slate-500'}`}>
                      {prog.classes?.name || "Tanpa Kelas"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Program Switcher (Mobile/Tablet) - Hidden in print */}
      {otherPrograms.length > 1 && (
        <div className="xl:hidden w-full max-w-4xl mx-auto px-4 sm:px-6 mb-6 relative z-20 print:hidden animate-in slide-in-from-top-4 duration-500">
          <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200/60 p-4">
             <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-3 text-sm">
                <History className="h-4 w-4 text-indigo-500" />
                Transkrip Program Lainnya:
             </h3>
             <div className="flex overflow-x-auto gap-3 pb-2 snap-x hide-scrollbar">
               {otherPrograms.map(prog => {
                 const isActive = prog.id === activeEnrollmentId;
                 return (
                   <button
                     key={prog.id}
                     onClick={() => setActiveEnrollmentId(prog.id)}
                     disabled={isActive}
                     className={`flex-none w-64 text-left p-3 rounded-xl transition-all duration-300 text-sm border snap-start ${
                       isActive 
                         ? 'bg-indigo-600 border-indigo-600 shadow-md' 
                         : 'bg-white border-slate-200 hover:bg-slate-50'
                     }`}
                   >
                     <p className={`font-bold truncate ${isActive ? 'text-white' : 'text-slate-800'}`}>
                       {prog.programs?.name || "Program"}
                     </p>
                     <p className={`text-[11px] truncate mt-1 ${isActive ? 'text-indigo-100' : 'text-slate-500'}`}>
                       {prog.classes?.name || "Tanpa Kelas"}
                     </p>
                   </button>
                 );
               })}
             </div>
          </div>
        </div>
      )}

      {/* Floating Controls - Hidden in print */}
      <div className="fixed bottom-8 inset-x-0 mx-auto w-fit z-50 print:hidden animate-in slide-in-from-bottom-8 duration-500">
        <div className="flex items-center gap-2 sm:gap-3 bg-white/80 backdrop-blur-md px-4 sm:px-6 py-3 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/50">
          <Button variant="ghost" onClick={() => onBack ? onBack() : navigate(-1)} className="rounded-full hover:bg-slate-100/80">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>
          <div className="w-px h-6 bg-slate-200 mx-1 sm:mx-2"></div>
          <Button onClick={() => window.print()} className="rounded-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 shadow-md text-white border-0">
            <Printer className="h-4 w-4 mr-2" />
            Cetak Transkrip
          </Button>
        </div>
      </div>

      {/* Document Wrapper */}
      <div className="relative w-full max-w-4xl mx-auto z-10 px-4 sm:px-6 mb-24 print:mb-0 animate-in fade-in zoom-in-95 duration-700">
        {/* Printable Area */}
        <div className="bg-white p-10 sm:p-16 rounded-2xl shadow-xl border border-slate-100/50 print:shadow-none print:border-none print:p-0 print:rounded-none">
        
        {/* Header */}
        <div className="text-center pb-8 border-b-2 border-slate-800 mb-8 flex flex-col items-center">
          {settings.logo_url && (
            <img src={settings.logo_url} alt="Logo" className="h-20 w-auto object-contain mb-4" />
          )}
          <h1 className="text-3xl font-bold text-slate-900 uppercase tracking-widest font-serif mb-2">Transkrip Akademik</h1>
          <p className="text-slate-700 mt-2 whitespace-pre-line text-lg font-medium">
            {settings.transcript_header_text || settings.institution_name}
          </p>
        </div>

        {/* Student Info */}
        <div className="grid grid-cols-2 gap-x-12 gap-y-4 mb-8 text-sm">
          <div className="grid grid-cols-[140px_auto] gap-2">
            <span className="font-semibold text-slate-700">Nama Peserta</span>
            <span className="text-slate-900 font-medium">: {participantName}</span>
            
            <span className="font-semibold text-slate-700">Nomor Induk (NIP)</span>
            <span className="text-slate-900 font-medium font-mono">: {participantNumber}</span>
          </div>
          <div className="grid grid-cols-[140px_auto] gap-2">
            <span className="font-semibold text-slate-700">Program</span>
            <span className="text-slate-900 font-medium">: {programName}</span>
            
            <span className="font-semibold text-slate-700">Kelas</span>
            <span className="text-slate-900 font-medium">: {className}</span>
          </div>
        </div>

        {/* Grades Table */}
        <div className="mb-10">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-50/80 print:bg-slate-100">
              <tr className="border-b-2 border-slate-800">
                <th className="py-4 px-4 sm:px-5 text-left font-bold text-slate-800 w-12 sm:w-16">No</th>
                <th className="py-4 px-4 sm:px-5 text-left font-bold text-slate-800">Materi Pembelajaran</th>
                <th className="py-4 px-4 sm:px-5 text-center font-bold text-slate-800 w-24 sm:w-36">Status</th>
                <th className="py-4 px-4 sm:px-5 text-center font-bold text-slate-800 w-20 sm:w-28">Nilai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 print:divide-slate-200">
              {modules.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500 italic">Belum ada materi pada program ini.</td>
                </tr>
              ) : (
                modules.map((module, mIndex) => {
                  const moduleLessons = lessons.filter(l => l.module_id === module.id);
                  return (
                    <optgroup key={module.id} className="contents">
                      {/* Module Header */}
                      <tr className="bg-slate-50/40">
                        <td className="py-3.5 px-4 sm:px-5 font-semibold text-slate-800 align-top">{mIndex + 1}</td>
                        <td className="py-3.5 px-4 sm:px-5 font-semibold text-slate-800" colSpan={3}>{module.title}</td>
                      </tr>
                      {/* Lessons */}
                      {moduleLessons.length === 0 ? (
                        <tr>
                          <td className="py-2 px-4"></td>
                          <td colSpan={3} className="py-2 px-4 text-slate-400 italic text-xs">- Tidak ada materi spesifik -</td>
                        </tr>
                      ) : (
                        moduleLessons.map((lesson, lIndex) => {
                          const p = progress.find(pr => pr.lesson_id === lesson.id);
                          const hasScore = p?.score !== null && p?.score !== undefined;
                          return (
                            <tr key={lesson.id} className="hover:bg-indigo-50/40 transition-colors duration-200 group">
                              <td className="py-3 px-4 sm:px-5 text-slate-400 group-hover:text-indigo-400 transition-colors text-xs text-right pr-6 align-top">{mIndex + 1}.{lIndex + 1}</td>
                              <td className="py-3 px-4 sm:px-5 text-slate-700 group-hover:text-slate-900 transition-colors">{lesson.title}</td>
                              <td className="py-3 px-4 sm:px-5 text-center align-middle">
                                {p ? (
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide ${p.status === 'completed' ? 'bg-emerald-100/80 text-emerald-700 print:bg-transparent print:text-slate-900 print:p-0 print:font-bold' : 'bg-amber-100/80 text-amber-700 print:bg-transparent print:text-slate-700 print:p-0'}`}>
                                    {p.status === 'completed' ? 'Selesai' : 'Diproses'}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 text-xs">-</span>
                                )}
                              </td>
                              <td className="py-3 px-4 sm:px-5 text-center font-mono font-semibold text-slate-800 align-middle group-hover:text-indigo-700 transition-colors">
                                {hasScore ? Number(p.score).toFixed(1) : '-'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </optgroup>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Final Result */}
        <div className="flex flex-col items-end border-t-2 border-slate-800 pt-6">
          <div className="w-full max-w-sm">
            <div className="flex justify-between items-center py-2 border-b border-slate-200">
              <span className="font-bold text-slate-700">Rata-rata Nilai</span>
              <span className="font-mono text-xl font-bold text-slate-900">{finalGrade !== null ? finalGrade.toFixed(2) : '-'}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-200">
              <span className="font-bold text-slate-700">Predikat (Hasil)</span>
              <span className="font-bold text-indigo-700 print:text-slate-900 text-lg uppercase tracking-wide">{predicate || '-'}</span>
            </div>
          </div>
        </div>
        
        {/* Signatures */}
        <div className="mt-20 grid grid-cols-2 text-center text-sm">
          <div>
            {/* Empty for spacing or student signature */}
          </div>
          <div className="flex flex-col items-center">
            <p className="mb-2 text-slate-600">
              {settings.transcript_place_date_text || "Yogyakarta, "}
              {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            {settings.transcript_signature_url ? (
              <div className="h-24 my-2 flex items-center justify-center">
                <img src={settings.transcript_signature_url} alt="Tanda Tangan" className="max-h-full max-w-[200px] object-contain mix-blend-multiply" />
              </div>
            ) : (
              <div className="h-24 my-2" />
            )}
            <p className="font-bold text-slate-900 underline decoration-slate-400 underline-offset-4">
              {settings.transcript_official_name || "Kepala Bagian Akademik"}
            </p>
            <p className="text-slate-700 mt-1 font-medium">{settings.transcript_official_title || "LMS YPIA"}</p>
          </div>
        </div>

      </div>
      </div>
    </div>
  );
}
