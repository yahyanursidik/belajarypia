import { supabase } from "./supabase";

export function inferFileCategory(mimeType: string | undefined, fileName = "") {
  const lowerName = fileName.toLowerCase();

  if (mimeType === "application/pdf" || lowerName.endsWith(".pdf")) {
    return "pdf";
  }

  if (mimeType?.startsWith("audio/")) {
    return "audio";
  }

  if (mimeType?.startsWith("video/")) {
    return "video";
  }

  if (
    mimeType?.includes("document") ||
    mimeType?.includes("text") ||
    lowerName.endsWith(".doc") ||
    lowerName.endsWith(".docx") ||
    lowerName.endsWith(".ppt") ||
    lowerName.endsWith(".pptx") ||
    lowerName.endsWith(".xls") ||
    lowerName.endsWith(".xlsx")
  ) {
    return "document";
  }

  return "other";
}

export async function requestSignedUploadUrl({
  lessonId,
  file,
}: {
  lessonId: string;
  file: File;
}) {
  const { data, error } = await supabase.functions.invoke("document-signed-url", {
    body: {
      operation: "upload",
      lesson_id: lessonId,
      file_name: file.name,
      mime_type: file.type || "application/octet-stream",
    },
  });

  if (error) {
    throw error;
  }

  return data as {
    bucket: string;
    objectKey: string;
    signedUrl: string;
    expiresIn: number;
  };
}

export async function requestSignedDownloadUrl(fileId: string) {
  const { data, error } = await supabase.functions.invoke("document-signed-url", {
    body: {
      operation: "download",
      file_id: fileId,
    },
  });

  if (error) {
    throw error;
  }

  return data as {
    signedUrl: string;
    expiresIn?: number;
    external?: boolean;
  };
}
