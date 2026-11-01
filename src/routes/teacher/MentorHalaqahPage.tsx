import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileText,
  ClipboardCheck,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FullPageLoader } from "@/components/ui/full-page-loader";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useMentorWorkspace, mentorLearning } from "../../lib/mentorData";
import { companionProgress } from "../../lib/companionWorkspace";

type ParticipantFilter = "all" | "not_started" | "in_progress" | "completed";

const pageSize = 10;

export function MentorHalaqahPage() {
  const {data,loading:isLoading,error:errorMessage,load:loadData}=useMentorWorkspace();
  const [params,setParams]=useSearchParams();
  const halaqahs=data?.halaqahs??[],enrollments=data?.enrollments??[];
  const requested=params.get('halaqah');
  const selectedHalaqahId=requested??halaqahs[0]?.id??null;
  const setSelectedHalaqahId=(id:string)=>setParams({halaqah:id});
  const searchQuery=params.get("q")??"";
  const setSearchQuery=(q:string)=>setParams(p=>{const n=new URLSearchParams(p);if(q)n.set("q",q);else n.delete("q");return n;},{replace:true});
  const rawFilter=params.get("status");
  const filter:ParticipantFilter=["not_started","in_progress","completed"].includes(rawFilter??"")?rawFilter as ParticipantFilter:"all";
  const setFilter=(status:ParticipantFilter)=>setParams(p=>{const n=new URLSearchParams(p);if(status!=="all")n.set("status",status);else n.delete("status");return n;});
  const [page,setPage]=useState(1);
  useEffect(()=>setPage(1),[filter,searchQuery,selectedHalaqahId]);
  const selectedHalaqah=halaqahs.find(h=>h.id===selectedHalaqahId)??null;
  const participantRows=useMemo(()=>data?data.enrollments.filter(e=>e.halaqah_id===selectedHalaqahId).map(e=>{const p=mentorLearning(e,data);return {...e,completedLessons:p.completed,totalLessons:p.total,percent:p.percent,learningStatus:p.learningStatus};}):[],[data,selectedHalaqahId]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return participantRows.filter((row) => {
      const participant = row.participants;
      const matchesSearch = !query || `${participant?.display_name} ${participant?.global_participant_number} ${row.enrollment_number}`.toLowerCase().includes(query);
      return matchesSearch && (filter === "all" || row.learningStatus === filter);
    });
  }, [filter, participantRows, searchQuery]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage=Math.min(page,totalPages);
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const averageProgress = companionProgress(participantRows.map(r=>({total:r.totalLessons,completed:r.completedLessons}))).percent;

  if (isLoading) return <FullPageLoader message="Memuat halaqah dan peserta binaan..." />;

  if(errorMessage)return <Alert><AlertTitle>Data pendampingan belum dapat dimuat</AlertTitle><AlertDescription>{errorMessage}</AlertDescription><Button variant="outline" onClick={()=>void loadData()}>Coba lagi</Button></Alert>;
  return (
    <div className="page-stack pb-12">
      <section className="rounded-lg border bg-background p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><Badge variant="outline">PENDAMPINGAN MUSYRIF</Badge><h1 className="mt-3 text-2xl font-bold sm:text-3xl">Halaqah & Peserta Binaan</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Progres dan latihan berikutnya untuk setiap binaan.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void loadData()}><RefreshCw className="h-4 w-4" /> Muat Ulang</Button><Button asChild><Link to={selectedHalaqahId?`/teacher/quran?halaqah=${selectedHalaqahId}`:"/teacher/quran"}><BookOpen className="h-4 w-4" /> Catat Setoran</Link></Button></div></div>
      </section>

      {errorMessage ? <Alert className="border-red-200 bg-red-50 text-red-900"><AlertCircle className="h-4 w-4" /><AlertTitle>Data halaqah tidak dapat dimuat</AlertTitle><AlertDescription>{errorMessage}</AlertDescription></Alert> : null}
      {!halaqahs.length ? <Alert><Users className="h-4 w-4" /><AlertTitle>Belum ada halaqah yang ditugaskan</AlertTitle><AlertDescription>Hubungi admin akademik untuk menetapkan Anda sebagai musyrif pada halaqah aktif.</AlertDescription></Alert> : (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex gap-2 overflow-x-auto pb-1">{halaqahs.map((item) => <button key={item.id} type="button" onClick={() => setSelectedHalaqahId(item.id)} className={`min-w-[210px] rounded-md border p-3 text-left ${item.id === selectedHalaqahId ? "border-primary bg-primary/5" : "bg-background hover:bg-muted/40"}`}><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-primary">{item.code}</span><Badge variant="outline">{enrollments.filter((row) => row.halaqah_id === item.id).length} peserta</Badge></div><p className="mt-2 font-semibold">{item.name}</p><p className="mt-1 text-xs text-muted-foreground">{item.classes?.name ?? "Kelas belum tersedia"}</p></button>)}</div>
            {selectedHalaqah?.classes?.program_id ? <div className="flex gap-2"><Button variant="outline" asChild><Link to={`/teacher/silabus?program=${selectedHalaqah.classes.program_id}`}><FileText className="h-4 w-4" /> Silabus</Link></Button><Button variant="outline" asChild><Link to={`/teacher/review?program=${selectedHalaqah.classes.program_id}`}><ClipboardCheck className="h-4 w-4"/>Penilaian ujian</Link></Button></div> : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border bg-emerald-50/40 p-4"><p className="text-xs text-muted-foreground">Peserta Binaan</p><p className="mt-1 text-2xl font-bold">{participantRows.length}</p><p className="text-xs text-muted-foreground">Kapasitas {selectedHalaqah?.capacity ?? "tidak dibatasi"}</p></div>
            <div className="rounded-xl border bg-emerald-50/40 p-4"><p className="text-xs text-muted-foreground">Progres materi binaan</p><p className="mt-1 text-2xl font-bold">{averageProgress===null?"—":averageProgress+"%"}</p><Progress value={averageProgress??0} className="mt-2 h-1.5" /></div>
            <div className="rounded-xl border bg-emerald-50/40 p-4"><p className="text-xs text-muted-foreground">Aktif Belajar</p><p className="mt-1 text-2xl font-bold">{participantRows.filter((row) => row.learningStatus === "in_progress").length}</p></div>
            <div className="rounded-xl border bg-emerald-50/40 p-4"><p className="text-xs text-muted-foreground">Belum Mulai</p><p className="mt-1 text-2xl font-bold">{participantRows.filter((row) => row.learningStatus === "not_started").length}</p></div>
          </div>

          <Card>
            <CardHeader className="border-b"><div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div><CardTitle className="text-lg">Direktori Peserta Binaan</CardTitle><p className="mt-1 text-sm text-muted-foreground">Cari peserta, pantau progres, lalu buka setoran atau penilaian.</p></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative min-w-[260px]"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} aria-label="Cari peserta binaan" placeholder="Nama atau nomor peserta" className="pl-9" /></div><select aria-label="Status belajar" className="field-control h-10 sm:w-[180px]" value={filter} onChange={(event) => setFilter(event.target.value as ParticipantFilter)}><option value="all">Semua status</option><option value="not_started">Belum mulai</option><option value="in_progress">Sedang belajar</option><option value="completed">Selesai</option></select></div></div></CardHeader>
            <CardContent className="p-0">
              {!pagedRows.length ? <div className="p-10 text-center text-sm text-muted-foreground">Tidak ada peserta yang sesuai dengan filter.</div> : <div className="divide-y">{pagedRows.map((row) => { const participant = row.participants; return <div key={row.id} className="grid gap-4 p-4 lg:grid-cols-[minmax(220px,1.4fr)_minmax(180px,1fr)_auto] lg:items-center"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">{participant?.display_name?.charAt(0).toUpperCase() ?? "P"}</span><div className="min-w-0"><p className="truncate font-semibold">{participant?.display_name ?? "Peserta"}</p><p className="text-xs text-muted-foreground">{participant?.global_participant_number} · {row.enrollment_number}</p></div></div><div><div className="flex items-center justify-between text-xs"><span>Progres materi</span><strong>{row.percent===null?"—":row.percent+"%"}</strong></div><Progress value={row.percent??0} className="mt-2 h-1.5" /><p className="mt-1 text-xs text-muted-foreground">{row.completedLessons}/{row.totalLessons} materi selesai</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" asChild><Link to={`/teacher/quran?halaqah=${row.halaqah_id}&enrollment=${row.id}`}><BookOpen className="h-4 w-4" /> Setoran</Link></Button><Button variant="outline" size="sm" asChild><Link to={`/teacher/review?program=${row.program_id}&q=${encodeURIComponent(row.enrollment_number)}`}><ClipboardCheck className="h-4 w-4"/>Hasil ujian</Link></Button></div></div>; })}</div>}
              <div className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">Menampilkan {filteredRows.length ? (page - 1) * pageSize + 1 : 0}-{Math.min(page * pageSize, filteredRows.length)} dari {filteredRows.length} peserta</p><div className="flex items-center gap-2"><Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft className="h-4 w-4" /><span className="sr-only">Halaman sebelumnya</span></Button><span className="min-w-20 text-center text-sm">{currentPage} / {totalPages}</span><Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}><ChevronRight className="h-4 w-4" /><span className="sr-only">Halaman berikutnya</span></Button></div></div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
