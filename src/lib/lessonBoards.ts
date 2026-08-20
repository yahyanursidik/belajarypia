import { supabase } from "./supabase";

export type LessonBoardLayout = "wall" | "columns";

export type LessonBoard = {
  id: string;
  lesson_id: string;
  layout: LessonBoardLayout;
  title: string | null;
  description: string | null;
};

export type LessonBoardColumn = {
  id: string;
  board_id: string;
  title: string;
  order_no: number;
};

export type LessonBoardPost = {
  id: string;
  board_id: string;
  column_id: string | null;
  title: string | null;
  body: string | null;
  image_object_key: string | null;
  image_mime_type: string | null;
  image_alt: string | null;
  order_no: number;
  created_at: string;
};

const MAX_BOARD_IMAGE_SIZE = 5 * 1024 * 1024;
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function validateBoardImage(file: File) {
  if (!allowedImageTypes.has(file.type)) {
    throw new Error("Gambar board harus berformat JPG, PNG, atau WebP.");
  }
  if (file.size < 1 || file.size > MAX_BOARD_IMAGE_SIZE) {
    throw new Error("Ukuran gambar board maksimal 5 MB.");
  }
}

async function invoke<T>(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("document-signed-url", { body });
  if (error) throw error;
  return data as T;
}

export async function uploadLessonBoardImage(boardId: string, file: File) {
  validateBoardImage(file);
  const upload = await invoke<{ objectKey: string; signedUrl: string; mimeType: string }>({
    operation: "board_image_upload",
    board_id: boardId,
    file_name: file.name,
    mime_type: file.type,
    file_size_bytes: file.size,
  });
  const response = await fetch(upload.signedUrl, {
    method: "PUT",
    headers: { "Content-Type": upload.mimeType },
    body: file,
  });
  if (!response.ok) throw new Error("Gambar tidak dapat diunggah ke penyimpanan privat.");
  return { objectKey: upload.objectKey, mimeType: upload.mimeType };
}

export async function requestLessonBoardImageUrl(postId: string) {
  return invoke<{ signedUrl: string }>({ operation: "board_image_download", post_id: postId });
}

export async function deleteLessonBoardImage(boardId: string, objectKey: string) {
  await invoke<{ deleted: boolean }>({
    operation: "board_image_delete",
    board_id: boardId,
    object_key: objectKey,
  });
}
