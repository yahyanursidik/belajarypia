import { useEffect, useState } from "react";
import { fetchTranscriptData, type TranscriptData } from "../lib/transcript";
import { Button } from "./ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TranscriptViewProps {
  enrollmentId: string;
  onBack?: () => void;
}

export function TranscriptView({ enrollmentId, onBack }: TranscriptViewProps) {
  const [data, setData] = useState<TranscriptData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const res = await fetchTranscriptData(enrollmentId);
      setData(res);
      setIsLoading(false);
    }
    load();
  }, [enrollmentId]);

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
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Controls - Hidden in print */}
      <div className="flex justify-between items-center print:hidden bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <Button variant="outline" onClick={() => onBack ? onBack() : navigate(-1)} className="shadow-sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali
        </Button>
        <div className="flex gap-2">
          <Button onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-700 shadow-sm">
            <Printer className="h-4 w-4 mr-2" />
            Cetak Transkrip
          </Button>
        </div>
      </div>

      {/* Printable Area */}
      <div className="bg-white p-8 sm:p-12 rounded-xl shadow-sm border border-slate-200 print:shadow-none print:border-none print:p-0">
        
        {/* Header */}
        <div className="text-center pb-8 border-b-2 border-slate-800 mb-8">
          <h1 className="text-3xl font-bold text-slate-900 uppercase tracking-widest font-serif">Transkrip Akademik</h1>
          <p className="text-slate-600 mt-2">Lembaga Pendidikan Bahasa Arab dan Studi Islam YPIA</p>
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
        <div className="mb-8">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 print:bg-slate-200 border-b-2 border-slate-800">
                <th className="py-3 px-4 text-left font-bold text-slate-800 w-16">No</th>
                <th className="py-3 px-4 text-left font-bold text-slate-800">Materi Pembelajaran</th>
                <th className="py-3 px-4 text-center font-bold text-slate-800 w-32">Status</th>
                <th className="py-3 px-4 text-center font-bold text-slate-800 w-24">Nilai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
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
                      <tr className="bg-slate-50/50">
                        <td className="py-3 px-4 font-semibold text-slate-700">{mIndex + 1}</td>
                        <td className="py-3 px-4 font-semibold text-slate-700" colSpan={3}>{module.title}</td>
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
                            <tr key={lesson.id} className="hover:bg-slate-50/30 transition-colors">
                              <td className="py-2.5 px-4 text-slate-500 text-xs text-right pr-6">{mIndex + 1}.{lIndex + 1}</td>
                              <td className="py-2.5 px-4 text-slate-800">{lesson.title}</td>
                              <td className="py-2.5 px-4 text-center">
                                {p ? (
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${p.status === 'completed' ? 'bg-emerald-100 text-emerald-800 print:bg-transparent print:text-slate-900 print:font-bold' : 'bg-amber-100 text-amber-800 print:bg-transparent print:text-slate-700'}`}>
                                    {p.status === 'completed' ? 'Selesai' : 'Diproses'}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-xs">-</span>
                                )}
                              </td>
                              <td className="py-2.5 px-4 text-center font-mono font-medium text-slate-900">
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
            <p className="mb-16 text-slate-600">Yogyakarta, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p className="font-bold text-slate-900 underline decoration-slate-400 underline-offset-4">Kepala Bagian Akademik</p>
            <p className="text-slate-500 mt-1">LMS YPIA</p>
          </div>
        </div>

      </div>
    </div>
  );
}
