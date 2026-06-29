import { useEffect, useState } from "react";
import { 
  FileCheck, 
  Search, 
  CheckCircle2,
  XCircle,
  X,
  RefreshCw,
  BookOpen,
  PlayCircle,
  FileText,
  Video,
  Clock,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useAuthSession } from "@/app/providers/authSessionContext";

type Lesson = {
  id: string;
  code: string;
  title: string;
  lesson_type: string;
  visibility_status: string;
  content_body: string | null;
  external_url: string | null;
  updated_at: string;
  program_modules?: {
    title: string;
    programs?: {
      name: string;
    };
  };
};

export function SystemContentReviewPage() {
    const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  
  // Filters & Pagination
  const [statusFilter, setStatusFilter] = useState("draft"); // Default to draft for review
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 20;

  const loadLessons = async (isLoadMore = false) => {
    if (!isLoadMore) {
      setIsLoading(true);
      setPage(0);
    }
    
    const currentPage = isLoadMore ? page + 1 : 0;
    
    // We need to join program_modules and programs to display context
    let query = supabase
      .from("lessons")
      .select(`
        id, code, title, lesson_type, visibility_status, content_body, external_url, updated_at,
        program_modules (
          title,
          programs ( name )
        )
      `, { count: "exact" })
      .order("updated_at", { ascending: false })
      .range(currentPage * LIMIT, (currentPage + 1) * LIMIT - 1);
      
    if (statusFilter !== "all") {
      query = query.eq("visibility_status", statusFilter);
    }
    
    if (searchQuery.trim()) {
      query = query.or(`title.ilike.%${searchQuery.trim()}%,code.ilike.%${searchQuery.trim()}%`);
    }
    
    const { data, count, error } = await query;
    if (data && !error) {
      if (isLoadMore) {
        setLessons(prev => {
          const newIds = data.map(d => d.id);
          const filteredPrev = prev.filter(p => !newIds.includes(p.id));
          return [...filteredPrev, ...(data as any)];
        });
      } else {
        setLessons(data as any);
      }
      setPage(currentPage);
      setHasMore(count !== null && (currentPage + 1) * LIMIT < count);
    }
    
    if (!isLoadMore) setIsLoading(false);
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      void loadLessons(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, statusFilter]);

  const handleChangeStatus = async (newStatus: string) => {
    if (!selectedLesson) return;
    const { error } = await supabase
      .from("lessons")
      .update({ visibility_status: newStatus })
      .eq("id", selectedLesson.id);
      
    if (!error) {
      setSelectedLesson({ ...selectedLesson, visibility_status: newStatus });
      void loadLessons(false);
    }
  };

  const getLessonIcon = (type: string) => {
    switch (type) {
      case "quiz": case "exam": return <FileText className="h-4 w-4 text-orange-500 shrink-0" />;
      case "live_session": return <Video className="h-4 w-4 text-rose-500 shrink-0" />;
      case "assignment": return <BookOpen className="h-4 w-4 text-blue-500 shrink-0" />;
      default: return <PlayCircle className="h-4 w-4 text-emerald-500 shrink-0" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case "draft": return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Menunggu Review</Badge>;
      case "published": return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Telah Terbit</Badge>;
      case "locked": return <Badge className="bg-slate-100 text-slate-700 border-slate-200">Terkunci</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  const renderPreview = (lesson: Lesson) => {
    const url = lesson.external_url?.toLowerCase() || "";
    
    // Video Embed (YouTube)
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      const videoId = url.includes("youtu.be")
        ? url.split("youtu.be/")[1]?.split("?")[0]
        : url.split("v=")[1]?.split("&")[0];
      return (
        <div className="space-y-4">
          <div className="aspect-video bg-black rounded-lg overflow-hidden border">
            <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${videoId}`} allowFullScreen title="YouTube Preview" />
          </div>
          {lesson.content_body && (
            <div className="bg-background border rounded-lg p-4 text-sm whitespace-pre-wrap">
              {lesson.content_body}
            </div>
          )}
        </div>
      );
    }

    // Direct Video Link
    if (url.endsWith(".mp4") || url.endsWith(".webm")) {
      return (
        <div className="space-y-4">
          <video className="w-full aspect-video rounded-lg bg-black border" controls src={url} />
          {lesson.content_body && (
            <div className="bg-background border rounded-lg p-4 text-sm whitespace-pre-wrap">
              {lesson.content_body}
            </div>
          )}
        </div>
      );
    }
    
    // Audio
    if (url.endsWith(".mp3") || url.endsWith(".wav") || url.endsWith(".ogg")) {
      return (
        <div className="space-y-4">
          <audio className="w-full mt-2" controls src={url} />
          {lesson.content_body && (
            <div className="bg-background border rounded-lg p-4 text-sm whitespace-pre-wrap">
              {lesson.content_body}
            </div>
          )}
        </div>
      );
    }

    // Quiz or Text Only
    if (lesson.lesson_type === 'quiz' || lesson.lesson_type === 'exam') {
      return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center text-amber-800">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <h3 className="font-bold text-lg mb-1">Materi Ujian / Kuis</h3>
          <p className="text-sm">Soal kuis dikelola di halaman Program Builder terpisah. Setujui form ini jika detail judul dan aturan kuis sudah sesuai.</p>
        </div>
      );
    }

    // Default Fallback
    return (
      <div className="space-y-4">
        {url && (
          <div className="bg-muted/50 border border-dashed rounded-lg p-4 text-center">
             <a href={url} target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium flex items-center justify-center gap-2">Buka Tautan Eksternal <ArrowRight className="w-4 h-4" /></a>
          </div>
        )}
        {lesson.content_body ? (
          <div className="bg-background border rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed">
            {lesson.content_body}
          </div>
        ) : (
          <div className="text-center p-8 text-muted-foreground">Tidak ada konten teks atau tautan yang tersedia.</div>
        )}
      </div>
    );
  };

  return (
    <div className="page-stack h-[calc(100vh-6rem)] flex flex-col p-4 md:p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
            <FileCheck className="text-primary w-6 h-6" />
            Review Konten Materi
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Tinjau dan berikan persetujuan penerbitan (Publish) untuk materi dari pengajar.</p>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex flex-1 gap-6 min-h-0">
        
        {/* Left Column: Lesson List */}
        <div className={`flex-col bg-card border rounded-xl shadow-sm overflow-hidden flex ${selectedLesson ? 'hidden md:flex w-1/3 max-w-sm' : 'w-full'}`}>
          <div className="p-4 border-b space-y-3 shrink-0 bg-muted/20">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input 
                placeholder="Cari materi..." 
                className="pl-9 h-9 text-sm bg-background"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 no-scrollbar">
              <div className="flex items-center gap-1.5">
                {(['draft', 'published', 'all'] as const).map(status => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors whitespace-nowrap ${statusFilter === status ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                  >
                    {status === 'all' ? 'Semua' : status === 'draft' ? 'Menunggu Review' : 'Telah Terbit'}
                  </button>
                ))}
              </div>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0 rounded-full" onClick={() => loadLessons(false)} disabled={isLoading}>
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto bg-muted/5">
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-r-transparent" />
              </div>
            ) : lessons.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-6 h-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-foreground">{searchQuery ? 'Tidak ada hasil pencarian' : 'Tidak ada materi'}</p>
                <p className="text-xs mt-1">Antrean review sudah bersih.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {lessons.map(lesson => (
                  <div 
                    key={lesson.id} 
                    className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${selectedLesson?.id === lesson.id ? 'bg-primary/5 border-l-2 border-primary' : 'border-l-2 border-transparent bg-background'}`}
                    onClick={() => setSelectedLesson(lesson)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-primary uppercase tracking-wider">{lesson.code}</span>
                      {getStatusBadge(lesson.visibility_status)}
                    </div>
                    <h3 className="font-medium text-sm text-foreground line-clamp-1 mb-1.5 flex items-center gap-2">
                      {getLessonIcon(lesson.lesson_type)} {lesson.title}
                    </h3>
                    <div className="text-xs text-muted-foreground truncate">
                      {lesson.program_modules?.programs?.name || 'Program'} • {lesson.program_modules?.title || 'Modul'}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-2 text-right">
                      Disimpan: {new Date(lesson.updated_at || '').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
                
                {hasMore && (
                  <div className="p-4 text-center">
                    <Button variant="outline" size="sm" onClick={() => loadLessons(true)} className="w-full text-xs">
                      Muat Lebih Banyak
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Preview Panel */}
        {selectedLesson ? (
          <div className="flex-1 bg-card border rounded-xl shadow-sm flex flex-col min-w-0">
            {/* Header */}
            <div className="p-4 border-b flex items-start justify-between bg-muted/10 shrink-0">
              <div className="min-w-0 pr-4">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="bg-background">{selectedLesson.code}</Badge>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{selectedLesson.lesson_type.replace('_', ' ')}</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(selectedLesson.updated_at || '').toLocaleDateString('id-ID')}</span>
                </div>
                <h2 className="text-lg font-bold text-foreground truncate">{selectedLesson.title}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <div className="text-sm font-medium flex items-center gap-1.5 text-primary">
                    <BookOpen className="w-4 h-4" /> {selectedLesson.program_modules?.programs?.name}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 border-l pl-2 ml-1">
                    {selectedLesson.program_modules?.title}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full md:hidden" onClick={() => setSelectedLesson(null)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Content Preview */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/50 dark:bg-slate-900/50">
               {renderPreview(selectedLesson)}
            </div>

            {/* Action Bar */}
            <div className="p-4 bg-background border-t shrink-0 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Status saat ini: {getStatusBadge(selectedLesson.visibility_status)}
              </div>
              <div className="flex gap-3">
                {selectedLesson.visibility_status === 'published' ? (
                   <Button variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => handleChangeStatus('draft')}>
                     <XCircle className="w-4 h-4 mr-2" /> Kembalikan ke Draft
                   </Button>
                ) : (
                   <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleChangeStatus('published')}>
                     <CheckCircle2 className="w-4 h-4 mr-2" /> Setujui & Terbitkan
                   </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center border rounded-xl border-dashed bg-muted/10">
            <div className="text-center p-8 max-w-sm">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 text-primary">
                <FileCheck className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">Pilih Materi</h3>
              <p className="text-sm text-muted-foreground">Pilih materi (lesson/kuis) di daftar sebelah kiri untuk mempratinjau isi konten dan menyetujuinya untuk terbit.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
