import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, Columns3, GripVertical, Image as ImageIcon, LayoutPanelTop, LoaderCircle, Pencil, Plus, Save, Trash2, Upload, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FullPageLoader } from "@/components/ui/full-page-loader";
import { Input } from "@/components/ui/input";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { deleteLessonBoardImage, requestLessonBoardImageUrl, type LessonBoard, type LessonBoardColumn, type LessonBoardPost, uploadLessonBoardImage } from "../../lib/lessonBoards";
import { supabase } from "../../lib/supabase";

type LessonInfo = { id: string; title: string; code: string; lesson_type: string; content_body: string | null };

const emptyPost = { title: "", body: "", imageAlt: "" };

function errorMessage(error: unknown) {
  return error && typeof error === "object" && "message" in error ? String(error.message) : "Terjadi kendala saat memproses board.";
}

export function LessonBoardEditorPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const location = useLocation();
  const { user } = useAuthSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lesson, setLesson] = useState<LessonInfo | null>(null);
  const [board, setBoard] = useState<LessonBoard | null>(null);
  const [columns, setColumns] = useState<LessonBoardColumn[]>([]);
  const [posts, setPosts] = useState<LessonBoardPost[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [boardTitle, setBoardTitle] = useState("");
  const [boardDescription, setBoardDescription] = useState("");
  const [layout, setLayout] = useState<"wall" | "columns">("wall");
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [postForm, setPostForm] = useState(emptyPost);
  const [postImage, setPostImage] = useState<File | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [draggingPostId, setDraggingPostId] = useState<string | null>(null);

  const returnPath = location.pathname.startsWith("/admin")
    ? "/admin/program"
    : location.pathname.startsWith("/system") ? "/system/program" : "/teacher/kelas";

  const loadBoard = useCallback(async () => {
    if (!lessonId || !user?.id) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data: lessonRow, error: lessonError } = await supabase
        .from("lessons")
        .select("id, title, code, lesson_type, content_body")
        .eq("id", lessonId)
        .single();
      if (lessonError || !lessonRow) throw lessonError ?? new Error("Materi tidak ditemukan.");
      if (lessonRow.lesson_type !== "board") throw new Error("Materi ini bukan tipe board.");
      setLesson(lessonRow as LessonInfo);

      const boardResult = await supabase
        .from("lesson_boards")
        .select("id, lesson_id, layout, title, description")
        .eq("lesson_id", lessonId)
        .maybeSingle();
      let boardRow = boardResult.data;
      if (boardResult.error) throw boardResult.error;
      if (!boardRow) {
        const created = await supabase
          .from("lesson_boards")
          .insert({ lesson_id: lessonId, title: lessonRow.title, description: lessonRow.content_body, created_by: user.id })
          .select("id, lesson_id, layout, title, description")
          .single();
        if (created.error || !created.data) throw created.error ?? new Error("Board tidak dapat dibuat.");
        boardRow = created.data;
      }

      const nextBoard = boardRow as LessonBoard;
      const [columnsResult, postsResult] = await Promise.all([
        supabase.from("lesson_board_columns").select("id, board_id, title, order_no").eq("board_id", nextBoard.id).order("order_no"),
        supabase.from("lesson_board_posts").select("id, board_id, column_id, title, body, image_object_key, image_mime_type, image_alt, order_no, created_at").eq("board_id", nextBoard.id).order("order_no").order("created_at"),
      ]);
      if (columnsResult.error || postsResult.error) throw columnsResult.error ?? postsResult.error;

      const nextPosts = (postsResult.data ?? []) as LessonBoardPost[];
      setBoard(nextBoard);
      setColumns((columnsResult.data ?? []) as LessonBoardColumn[]);
      setPosts(nextPosts);
      setBoardTitle(nextBoard.title || lessonRow.title);
      setBoardDescription(nextBoard.description || "");
      setLayout(nextBoard.layout);

      const signedImages = await Promise.all(nextPosts.filter((post) => post.image_object_key).map(async (post) => {
        try {
          const { signedUrl } = await requestLessonBoardImageUrl(post.id);
          return [post.id, signedUrl] as const;
        } catch {
          return null;
        }
      }));
      setImageUrls(Object.fromEntries(signedImages.filter((entry): entry is readonly [string, string] => entry !== null)));
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [lessonId, user?.id]);

  useEffect(() => { void loadBoard(); }, [loadBoard]);

  const orderedColumns = useMemo(() => [...columns].sort((a, b) => a.order_no - b.order_no), [columns]);
  const sortedPosts = useMemo(() => [...posts].sort((a, b) => a.order_no - b.order_no || a.created_at.localeCompare(b.created_at)), [posts]);

  const ensureColumn = async () => {
    if (!board) throw new Error("Board belum siap.");
    if (columns.length) return columns[0];
    const { data, error: columnError } = await supabase
      .from("lesson_board_columns")
      .insert({ board_id: board.id, title: "Materi", order_no: 1 })
      .select("id, board_id, title, order_no")
      .single();
    if (columnError || !data) throw columnError ?? new Error("Kolom awal tidak dapat dibuat.");
    setColumns([data as LessonBoardColumn]);
    return data as LessonBoardColumn;
  };

  const saveBoardSettings = async () => {
    if (!board) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (layout === "columns") await ensureColumn();
      const { error: updateError } = await supabase
        .from("lesson_boards")
        .update({ title: boardTitle.trim() || null, description: boardDescription.trim() || null, layout })
        .eq("id", board.id);
      if (updateError) throw updateError;
      setSuccess("Pengaturan board disimpan.");
      await loadBoard();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  };

  const addColumn = async () => {
    if (!board || !newColumnTitle.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      const { error: insertError } = await supabase.from("lesson_board_columns").insert({
        board_id: board.id,
        title: newColumnTitle.trim(),
        order_no: columns.length + 1,
      });
      if (insertError) throw insertError;
      setNewColumnTitle("");
      await loadBoard();
    } catch (columnError) {
      setError(errorMessage(columnError));
    } finally {
      setIsSaving(false);
    }
  };

  const deleteColumn = async (column: LessonBoardColumn) => {
    if (!board || columns.length <= 1) return;
    if (!window.confirm(`Hapus kolom "${column.title}"? Kartu akan dipindahkan ke kolom pertama.`)) return;
    const fallback = columns.find((item) => item.id !== column.id);
    if (!fallback) return;
    setIsSaving(true);
    try {
      const moveResult = await supabase.from("lesson_board_posts").update({ column_id: fallback.id }).eq("column_id", column.id);
      if (moveResult.error) throw moveResult.error;
      const deleteResult = await supabase.from("lesson_board_columns").delete().eq("id", column.id);
      if (deleteResult.error) throw deleteResult.error;
      await loadBoard();
    } catch (columnError) {
      setError(errorMessage(columnError));
    } finally {
      setIsSaving(false);
    }
  };

  const resetPostComposer = () => {
    setPostForm(emptyPost);
    setPostImage(null);
    setEditingPostId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const savePost = async () => {
    if (!board) return;
    if (!postForm.title.trim() && !postForm.body.trim() && !postImage && !editingPostId) {
      setError("Isi teks, judul, atau pilih satu gambar untuk membuat kartu.");
      return;
    }
    const currentPost = editingPostId ? posts.find((post) => post.id === editingPostId) ?? null : null;
    setIsSaving(true);
    setError(null);
    try {
      let uploadedImage: { objectKey: string; mimeType: string } | null = null;
      if (postImage) {
        setIsUploading(true);
        uploadedImage = await uploadLessonBoardImage(board.id, postImage);
      }
      const payload = {
        title: postForm.title.trim() || null,
        body: postForm.body.trim() || null,
        image_alt: postForm.imageAlt.trim() || null,
        ...(uploadedImage ? { image_object_key: uploadedImage.objectKey, image_mime_type: uploadedImage.mimeType } : {}),
      };
      if (currentPost) {
        const { error: updateError } = await supabase.from("lesson_board_posts").update(payload).eq("id", currentPost.id);
        if (updateError) throw updateError;
        if (uploadedImage && currentPost.image_object_key) void deleteLessonBoardImage(board.id, currentPost.image_object_key).catch(() => undefined);
      } else {
        let targetColumnId: string | null = null;
        if (layout === "columns") targetColumnId = (await ensureColumn()).id;
        const orderNo = sortedPosts.filter((post) => (layout === "columns" ? (post.column_id || targetColumnId) === targetColumnId : true)).length + 1;
        const { error: insertError } = await supabase.from("lesson_board_posts").insert({
          board_id: board.id,
          column_id: targetColumnId,
          order_no: orderNo,
          created_by: user?.id ?? null,
          ...payload,
        });
        if (insertError) throw insertError;
      }
      resetPostComposer();
      setSuccess(currentPost ? "Kartu board diperbarui." : "Kartu board ditambahkan.");
      await loadBoard();
    } catch (postError) {
      setError(errorMessage(postError));
    } finally {
      setIsSaving(false);
      setIsUploading(false);
    }
  };

  const editPost = (post: LessonBoardPost) => {
    setEditingPostId(post.id);
    setPostForm({ title: post.title || "", body: post.body || "", imageAlt: post.image_alt || "" });
    setPostImage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deletePost = async (post: LessonBoardPost) => {
    if (!board || !window.confirm("Hapus kartu board ini?")) return;
    setIsSaving(true);
    try {
      const { error: deleteError } = await supabase.from("lesson_board_posts").delete().eq("id", post.id);
      if (deleteError) throw deleteError;
      if (post.image_object_key) void deleteLessonBoardImage(board.id, post.image_object_key).catch(() => undefined);
      if (editingPostId === post.id) resetPostComposer();
      await loadBoard();
    } catch (postError) {
      setError(errorMessage(postError));
    } finally {
      setIsSaving(false);
    }
  };

  const normalizedColumnId = (post: LessonBoardPost) => layout === "columns" ? post.column_id || orderedColumns[0]?.id || null : null;
  const movePost = async (postId: string, destinationColumnId: string | null, beforePostId?: string) => {
    const moving = posts.find((post) => post.id === postId);
    if (!moving || !board) return;
    const resolvedDestination = layout === "columns" ? destinationColumnId || orderedColumns[0]?.id || null : null;
    const sourceColumnId = normalizedColumnId(moving);
    const remaining = posts.filter((post) => post.id !== postId);
    const targetPosts = remaining.filter((post) => normalizedColumnId(post) === resolvedDestination).sort((a, b) => a.order_no - b.order_no);
    const insertionIndex = beforePostId ? Math.max(0, targetPosts.findIndex((post) => post.id === beforePostId)) : targetPosts.length;
    const moved = { ...moving, column_id: resolvedDestination };
    targetPosts.splice(insertionIndex, 0, moved);
    const affectedColumnIds = new Set([sourceColumnId, resolvedDestination]);
    const patches: Array<{ id: string; column_id: string | null; order_no: number }> = [];
    affectedColumnIds.forEach((columnId) => {
      const group = columnId === resolvedDestination
        ? targetPosts
        : remaining.filter((post) => normalizedColumnId(post) === columnId).sort((a, b) => a.order_no - b.order_no);
      group.forEach((post, index) => patches.push({ id: post.id, column_id: columnId, order_no: index + 1 }));
    });
    setIsSaving(true);
    try {
      const results = await Promise.all(patches.map((patch) => supabase.from("lesson_board_posts").update({ column_id: patch.column_id, order_no: patch.order_no }).eq("id", patch.id)));
      const failed = results.find((result) => result.error)?.error;
      if (failed) throw failed;
      await loadBoard();
    } catch (moveError) {
      setError(errorMessage(moveError));
    } finally {
      setIsSaving(false);
      setDraggingPostId(null);
    }
  };

  if (isLoading) return <FullPageLoader message="Menyiapkan board materi..." />;
  if (!board || !lesson) return <Alert className="border-red-200 bg-red-50 text-red-900"><AlertTitle>Board tidak tersedia</AlertTitle><AlertDescription>{error || "Board belum dapat dibuka."}</AlertDescription></Alert>;

  const renderPost = (post: LessonBoardPost, columnId: string | null) => (
    <Card
      key={post.id}
      draggable
      onDragStart={() => setDraggingPostId(post.id)}
      onDragEnd={() => setDraggingPostId(null)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => { event.preventDefault(); event.stopPropagation(); if (draggingPostId && draggingPostId !== post.id) void movePost(draggingPostId, columnId, post.id); }}
      className={`mb-3 cursor-grab break-inside-avoid overflow-hidden border-border/70 bg-background shadow-sm active:cursor-grabbing ${draggingPostId === post.id ? "opacity-50" : ""}`}
    >
      {imageUrls[post.id] && <img src={imageUrls[post.id]} alt={post.image_alt || post.title || "Gambar materi"} className="max-h-72 w-full object-cover" />}
      <CardContent className="p-4">
        <div className="mb-2 flex items-start justify-between gap-2"><GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><div className="flex gap-1"><Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => editPost(post)}><Pencil className="h-3.5 w-3.5" /></Button><Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => void deletePost(post)}><Trash2 className="h-3.5 w-3.5" /></Button></div></div>
        {post.title && <h3 className="text-sm font-semibold leading-snug text-foreground">{post.title}</h3>}
        {post.body && <p className={`${post.title ? "mt-2" : ""} whitespace-pre-wrap text-sm leading-6 text-muted-foreground`}>{post.body}</p>}
      </CardContent>
    </Card>
  );

  return (
    <div className="page-stack pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost"><Link to={returnPath}><ArrowLeft className="mr-2 h-4 w-4" />Kembali ke Program</Link></Button>
        <Badge variant="outline">{lesson.code}</Badge>
      </div>

      <section className="page-hero">
        <Badge variant="secondary" className="mb-3 border-white/30 bg-white/20 text-white">BOARD MATERI</Badge>
        <h1 className="text-3xl font-bold text-white">{lesson.title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80">Susun kartu teks dan gambar, lalu tarik kartu untuk mengatur alur materi.</p>
      </section>

      {error && <Alert className="border-red-200 bg-red-50 text-red-900"><AlertTitle>Board belum tersimpan</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900"><AlertTitle>Berhasil</AlertTitle><AlertDescription>{success}</AlertDescription></Alert>}

      <Card>
        <CardHeader><CardTitle>Pengaturan Board</CardTitle></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <div><label className="mb-1 block text-sm font-semibold">Judul Board</label><Input value={boardTitle} onChange={(event) => setBoardTitle(event.target.value)} placeholder="Contoh: Peta Konsep Pertemuan 1" /></div>
          <div><label className="mb-1 block text-sm font-semibold">Deskripsi Singkat</label><Input value={boardDescription} onChange={(event) => setBoardDescription(event.target.value)} placeholder="Tujuan atau pengantar board" /></div>
          <div className="flex gap-2"><Button type="button" variant={layout === "wall" ? "default" : "outline"} onClick={() => setLayout("wall")}><LayoutPanelTop className="mr-2 h-4 w-4" />Wall</Button><Button type="button" variant={layout === "columns" ? "default" : "outline"} onClick={() => setLayout("columns")}><Columns3 className="mr-2 h-4 w-4" />Kolom</Button><Button type="button" onClick={() => void saveBoardSettings()} disabled={isSaving}><Save className="mr-2 h-4 w-4" />Simpan</Button></div>
        </CardContent>
      </Card>

      {layout === "columns" && <Card><CardContent className="flex flex-wrap items-end gap-3 p-4"><div className="min-w-60 flex-1"><label className="mb-1 block text-sm font-semibold">Kolom Baru</label><Input value={newColumnTitle} onChange={(event) => setNewColumnTitle(event.target.value)} placeholder="Contoh: Pengantar" /></div><Button type="button" onClick={() => void addColumn()} disabled={isSaving || !newColumnTitle.trim()}><Plus className="mr-2 h-4 w-4" />Tambah Kolom</Button></CardContent></Card>}

      <Card id="board-composer">
        <CardHeader><CardTitle>{editingPostId ? "Edit Kartu Materi" : "Tambah Kartu Materi"}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2"><div><label className="mb-1 block text-sm font-semibold">Judul (opsional)</label><Input value={postForm.title} onChange={(event) => setPostForm((current) => ({ ...current, title: event.target.value }))} placeholder="Judul kartu" /></div><div><label className="mb-1 block text-sm font-semibold">Keterangan gambar (opsional)</label><Input value={postForm.imageAlt} onChange={(event) => setPostForm((current) => ({ ...current, imageAlt: event.target.value }))} placeholder="Deskripsi gambar untuk peserta" /></div></div>
          <div><label className="mb-1 block text-sm font-semibold">Isi Materi</label><textarea className="field-control min-h-[130px]" value={postForm.body} onChange={(event) => setPostForm((current) => ({ ...current, body: event.target.value }))} placeholder="Tulis poin, penjelasan, pertanyaan refleksi, atau arahan belajar..." /></div>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed bg-muted/20 p-4"><ImageIcon className="h-5 w-5 text-primary" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">Gambar pendukung (opsional)</p><p className="text-xs text-muted-foreground">JPG, PNG, atau WebP. Maksimal 5 MB dan tersimpan privat.</p>{postImage && <p className="mt-1 truncate text-xs font-medium text-primary">{postImage.name}</p>}</div><Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" />Pilih Gambar</Button><input ref={fileInputRef} type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPostImage(event.target.files?.[0] ?? null)} /></div>
          <div className="flex justify-end gap-2">{editingPostId && <Button type="button" variant="outline" onClick={resetPostComposer}>Batal Edit</Button>}<Button type="button" onClick={() => void savePost()} disabled={isSaving}>{isUploading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}{editingPostId ? "Simpan Kartu" : "Tambah ke Board"}</Button></div>
        </CardContent>
      </Card>

      <section className="rounded-xl border border-border/70 bg-muted/20 p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Kanvas Board</h2><p className="mt-1 text-sm text-muted-foreground">Tarik kartu ke posisi atau kolom tujuan untuk mengubah urutan.</p></div><Badge variant="outline">{posts.length} kartu</Badge></div>
        {layout === "columns" ? <div className="flex gap-4 overflow-x-auto pb-2">{orderedColumns.map((column) => { const columnPosts = sortedPosts.filter((post) => normalizedColumnId(post) === column.id); return <div key={column.id} className="w-[310px] shrink-0 rounded-xl border bg-background/70 p-3" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (draggingPostId) void movePost(draggingPostId, column.id); }}><div className="mb-3 flex items-center justify-between gap-2"><h3 className="font-semibold">{column.title}</h3>{orderedColumns.length > 1 && <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600" onClick={() => void deleteColumn(column)}><X className="h-4 w-4" /></Button>}</div>{columnPosts.length ? columnPosts.map((post) => renderPost(post, column.id)) : <div className="rounded-lg border border-dashed p-5 text-center text-xs text-muted-foreground">Tarik kartu ke sini</div>}</div>; })}</div> : <div className="columns-1 gap-4 sm:columns-2 xl:columns-3" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (draggingPostId) void movePost(draggingPostId, null); }}>{sortedPosts.length ? sortedPosts.map((post) => renderPost(post, null)) : <div className="rounded-lg border border-dashed bg-background p-10 text-center text-sm text-muted-foreground">Belum ada kartu. Tambahkan materi pertama dari formulir di atas.</div>}</div>}
      </section>
    </div>
  );
}
