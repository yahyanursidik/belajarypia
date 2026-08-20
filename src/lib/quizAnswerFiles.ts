import { supabase } from "./supabase";
import type { QuizAttemptAnswerFile } from "./academic";

export type { QuizAttemptAnswerFile } from "./academic";

export const QUIZ_ANSWER_MAX_FILE_SIZE = 10 * 1024 * 1024;
export const QUIZ_ANSWER_MAX_FILES_PER_QUESTION = 5;

type UploadUrl = {
  bucket: string;
  objectKey: string;
  signedUrl: string;
  mimeType: string;
};

function extensionOf(fileName: string) {
  return fileName.trim().toLowerCase().split(".").pop() ?? "";
}

export function quizAnswerMimeType(file: File) {
  const extension = extensionOf(file.name);
  const mimeByExtension: Record<string, string> = {
    txt: "text/plain",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  return mimeByExtension[extension] ?? null;
}

export function validateQuizAnswerFile(file: File) {
  const mimeType = quizAnswerMimeType(file);
  if (!mimeType) {
    throw new Error("Jenis file tidak dapat dikenali. Gunakan .txt, .pdf, .doc, atau .docx.");
  }
  if (file.size < 1 || file.size > QUIZ_ANSWER_MAX_FILE_SIZE) {
    throw new Error("Ukuran setiap lampiran maksimal 10 MB.");
  }
  return mimeType;
}

async function invoke<T>(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("document-signed-url", { body });
  if (error) throw error;
  return data as T;
}

export async function uploadQuizAnswerFile({
  attemptId,
  questionId,
  file,
}: {
  attemptId: string;
  questionId: string;
  file: File;
}) {
  const mimeType = validateQuizAnswerFile(file);
  const upload = await invoke<UploadUrl>({
    operation: "quiz_answer_upload",
    attempt_id: attemptId,
    question_id: questionId,
    file_name: file.name,
    mime_type: mimeType,
    file_size_bytes: file.size,
  });

  const response = await fetch(upload.signedUrl, {
    method: "PUT",
    headers: { "Content-Type": upload.mimeType },
    body: file,
  });
  if (!response.ok) throw new Error("Upload lampiran ke penyimpanan gagal.");

  return invoke<QuizAttemptAnswerFile>({
    operation: "quiz_answer_complete",
    attempt_id: attemptId,
    question_id: questionId,
    bucket_name: upload.bucket,
    object_key: upload.objectKey,
    file_name: file.name,
    mime_type: upload.mimeType,
    file_size_bytes: file.size,
  });
}

export async function requestQuizAnswerDownloadUrl(fileId: string) {
  return invoke<{ signedUrl: string; displayName: string }>({
    operation: "quiz_answer_download",
    file_id: fileId,
  });
}

export async function deleteQuizAnswerFile(fileId: string) {
  await invoke<{ deleted: boolean }>({ operation: "quiz_answer_delete", file_id: fileId });
}
