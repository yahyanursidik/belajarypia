import {
  mergeWithDefaultFeatureFlags,
  type MvpFeatureFlags,
  type Program,
} from "./organization.ts";

export type ProgramSection =
  | "detail-program"
  | "silabus"
  | "kurikulum"
  | "bank-soal"
  | "pendaftaran"
  | "angkatan-kelas"
  | "peserta"
  | "kelulusan"
  | "report";
export const programGroups = [
  { key: "overview", label: "Ringkasan", sections: ["detail-program"] },
  {
    key: "learning",
    label: "Pembelajaran",
    sections: ["silabus", "kurikulum", "bank-soal"],
  },
  { key: "admission", label: "Pendaftaran", sections: ["pendaftaran"] },
  {
    key: "participants",
    label: "Peserta & kelas",
    sections: ["peserta", "angkatan-kelas"],
  },
  { key: "results", label: "Hasil belajar", sections: ["report", "kelulusan"] },
] as const;
export const programSectionLabels: Record<ProgramSection, string> = {
  "detail-program": "Ringkasan",
  silabus: "Silabus",
  kurikulum: "Materi & ujian",
  "bank-soal": "Bank soal",
  pendaftaran: "Pendaftaran",
  "angkatan-kelas": "Angkatan & kelas",
  peserta: "Peserta",
  kelulusan: "Kelulusan",
  report: "Laporan",
};
export const programStatusLabels = {
  active: "Aktif",
  draft: "Draf",
  archived: "Diarsipkan",
};
export function programDirectoryPath(
  basePath: string,
  requested: string | null,
) {
  const root = basePath === "/teacher/kelas" ? basePath : `${basePath}/program`;
  return requested === root || requested?.startsWith(`${root}?`)
    ? requested
    : root;
}
export function programSectionPath(
  basePath: string,
  id: string,
  section: ProgramSection,
  returnTo?: string,
) {
  const query = new URLSearchParams();
  if (returnTo && returnTo !== `${basePath}/program`)
    query.set("returnTo", programDirectoryPath(basePath, returnTo));
  return `${basePath}/program/${id}/${section}${query.size ? `?${query}` : ""}`;
}
export function programModelLabel(model: string) {
  return model === "angkatan"
    ? "Terjadwal"
    : model === "mandiri"
      ? "Mandiri"
      : model;
}
export function normalizeProgramFlags(
  flags?: Partial<MvpFeatureFlags> | null,
): MvpFeatureFlags {
  const merged = mergeWithDefaultFeatureFlags(flags);
  const paymentType =
    flags?.payment_type ?? (flags?.use_payment ? "spp" : "free");
  return {
    ...merged,
    payment_type: paymentType,
    use_payment: paymentType === "spp",
    payment_amount:
      paymentType === "free" ? 0 : Number(merged.payment_amount ?? 0),
  };
}
export type ProgramSetupSummary = {
  modules: number;
  lessons: number;
  publishedLessons: number;
  quizLessons: number;
  batches: number;
  classes: number;
  halaqahs: number;
  questionBanks: number;
  participants: number;
};
export function programSetupItems(
  program: Program,
  summary: ProgramSetupSummary,
) {
  return [
    {
      key: "profile",
      label: "Profil program",
      done: Boolean(program.description?.trim()),
      section: "detail-program" as ProgramSection,
    },
    {
      key: "syllabus",
      label: "Silabus",
      done: Boolean(program.syllabus?.trim()),
      section: "silabus" as ProgramSection,
    },
    {
      key: "curriculum",
      label: "Mata pelajaran",
      done: summary.modules > 0,
      section: "kurikulum" as ProgramSection,
    },
    {
      key: "lessons",
      label: "Materi diterbitkan",
      done: summary.publishedLessons > 0,
      section: "kurikulum" as ProgramSection,
    },
    ...(program.curriculum_model === "angkatan"
      ? [
          {
            key: "classes",
            label: "Angkatan & kelas",
            done: summary.batches > 0 && summary.classes > 0,
            section: "angkatan-kelas" as ProgramSection,
          },
        ]
      : []),
    {
      key: "graduation",
      label: "Kriteria kelulusan",
      done: Boolean(program.grading_rubric?.length),
      section: "kelulusan" as ProgramSection,
    },
  ];
}
export function validProgramPage(value: string | null) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}
export function validateLessonSettings(input: {
  title: string;
  module_id: string;
  lesson_type: string;
  release_at: string;
  external_url: string;
  passing_grade: string;
  duration_minutes: string;
  max_attempts: string;
  randomized_questions_count: string;
  max_tab_switches: string;
  order_no: string;
}) {
  if (!input.title.trim() || !input.module_id)
    return "Isi judul dan pilih mata pelajaran.";
  if (
    input.release_at &&
    !Number.isFinite(new Date(input.release_at).getTime())
  )
    return "Waktu rilis tidak valid.";
  if (
    input.lesson_type === "live_session" &&
    (!input.release_at || !isHttpUrl(input.external_url))
  )
    return "Isi waktu mulai dan tautan pertemuan yang valid.";
  if (
    input.passing_grade &&
    (!Number.isFinite(Number(input.passing_grade)) ||
      Number(input.passing_grade) < 0 ||
      Number(input.passing_grade) > 100)
  )
    return "Nilai kelulusan harus antara 0–100.";
  for (const [label, value, min] of [
    ["Durasi", input.duration_minutes, 1],
    ["Percobaan", input.max_attempts, 1],
    ["Jumlah soal acak", input.randomized_questions_count, 0],
    ["Toleransi pindah tab", input.max_tab_switches, 0],
    ["Urutan", input.order_no, 0],
  ] as const) {
    if (value && (!Number.isSafeInteger(Number(value)) || Number(value) < min))
      return `${label} harus berupa bilangan bulat minimal ${min}.`;
  }
  return null;
}
export function isHttpUrl(value: string) {
  try {
    return ["https:", "http:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
export function validateProgramUpload(file: {
  name: string;
  type: string;
  size: number;
}) {
  if (
    file.type.startsWith("audio/") ||
    file.type.startsWith("video/") ||
    !/\.(pdf|docx|xlsx|pptx|jpg|jpeg|png|webp)$/i.test(file.name)
  )
    return "Gunakan PDF, DOCX, XLSX, PPTX, JPG, PNG, atau WebP.";
  return file.size > 20 * 1024 * 1024 ? "Ukuran file maksimal 20 MB." : null;
}
