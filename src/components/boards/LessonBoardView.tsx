import { Columns3, Image as ImageIcon, LayoutPanelTop } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { LessonBoard, LessonBoardColumn, LessonBoardPost } from "../../lib/lessonBoards";

type Props = {
  board: LessonBoard;
  columns: LessonBoardColumn[];
  posts: LessonBoardPost[];
  imageUrls: Record<string, string>;
  className?: string;
};

function PostCard({ post, imageUrl }: { post: LessonBoardPost; imageUrl?: string }) {
  return (
    <Card className="mb-4 break-inside-avoid overflow-hidden border-border/70 bg-card shadow-sm">
      {imageUrl && (
        <img src={imageUrl} alt={post.image_alt || post.title || "Gambar materi"} className="max-h-[420px] w-full object-cover" />
      )}
      <CardContent className="p-4">
        {post.title && <h3 className="text-base font-semibold leading-snug text-foreground">{post.title}</h3>}
        {post.body && <p className={`${post.title ? "mt-2" : ""} whitespace-pre-wrap text-sm leading-6 text-muted-foreground`}>{post.body}</p>}
        {post.image_object_key && !imageUrl && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><ImageIcon className="h-4 w-4" /> Memuat gambar materi...</div>
        )}
      </CardContent>
    </Card>
  );
}

export function LessonBoardView({ board, columns, posts, imageUrls, className = "" }: Props) {
  const sortedPosts = [...posts].sort((a, b) => a.order_no - b.order_no || a.created_at.localeCompare(b.created_at));
  const isColumns = board.layout === "columns";

  return (
    <section className={`overflow-hidden rounded-xl border border-border/70 bg-muted/30 p-4 shadow-sm sm:p-6 ${className}`}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {isColumns ? <Columns3 className="h-5 w-5 text-primary" /> : <LayoutPanelTop className="h-5 w-5 text-primary" />}
            <h2 className="text-xl font-bold text-foreground">{board.title || "Papan Materi"}</h2>
          </div>
          {board.description && <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{board.description}</p>}
        </div>
        <Badge variant="outline" className="bg-background/70">{isColumns ? "Tampilan Kolom" : "Tampilan Dinding"}</Badge>
      </div>

      {sortedPosts.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-background/70 p-10 text-center text-sm text-muted-foreground">Belum ada kartu materi pada board ini.</div>
      ) : isColumns ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {columns.map((column) => {
            const columnPosts = sortedPosts.filter((post) => (post.column_id || columns[0]?.id) === column.id);
            return (
              <div key={column.id} className="w-[300px] shrink-0 rounded-xl border border-border/70 bg-background/70 p-3 sm:w-[340px]">
                <h3 className="mb-3 px-1 text-sm font-semibold text-foreground">{column.title}</h3>
                {columnPosts.length ? columnPosts.map((post) => <PostCard key={post.id} post={post} imageUrl={imageUrls[post.id]} />) : <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">Belum ada kartu.</p>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="columns-1 gap-4 sm:columns-2 xl:columns-3">
          {sortedPosts.map((post) => <PostCard key={post.id} post={post} imageUrl={imageUrls[post.id]} />)}
        </div>
      )}
    </section>
  );
}
