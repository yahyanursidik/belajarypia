export type QuranRecord = {
    id: string;
    assessment_date: string;
    submission_type: string;
    surah_name: string;
    ayah_from: number | null;
    ayah_to: number | null;
    fluency_score: number | null;
    tajwid_score: number | null;
    memorization_score: number | null;
    notes: string | null;
    next_target: string | null;
};
export type GuardianEnrollment = {
    id: string;
    program_id: string;
    program_name: string;
    number: string;
    status: string;
    class_name: string | null;
    halaqah_name: string | null;
    total: number;
    completed: number;
    tasks: {
        id: string;
        title: string;
        due_at: string | null;
        status: string;
        score: number | null;
    }[];
    task_total: number;
    quran: QuranRecord[];
};
export type GuardianChild = {
    id: string;
    name: string;
    number: string;
    status: string;
    enrollments: GuardianEnrollment[];
};
export type GuardianWorkspace = {
    generated_at: string;
    children: GuardianChild[];
};
export const taskLabels: Record<string, string> = { not_submitted: 'Belum dikumpulkan', submitted: 'Menunggu penilaian', needs_revision: 'Perlu revisi', accepted: 'Nilai final' };
export const quranKinds: Record<string, string> = { hafalan: 'Hafalan', murajaah: 'Murajaah', tilawah: 'Tilawah' };
export function companionProgress(rows: Pick<GuardianEnrollment, 'total' | 'completed'>[]) {
    const total = rows.reduce((n, r) => n + r.total, 0), completed = rows.reduce((n, r) => n + Math.min(r.total, r.completed), 0);
    return { total, completed, percent: total ? Math.round(completed * 100 / total) : null };
}
export function companionError(e: unknown) {
    const error = e as {
        code?: string;
        message?: string;
    };
    if (error?.code === 'PGRST202' || /does not exist|schema cache/i.test(error?.message ?? ''))
        return 'Layanan pendampingan belum diaktifkan. Hubungi pengelola melalui Bantuan.';
    return error?.message || 'Data belum dapat dimuat. Coba lagi.';
}
