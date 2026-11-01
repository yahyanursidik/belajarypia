import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthSession } from '../app/providers/authSessionContext';
import { supabase } from './supabase';
import { teachingRows } from './teacherData';
import { teachingProgress, type TeachingLesson } from './teacherWorkspace';
import { wibDateKey } from './dateRange';
import type { MentorEnrollment, MentorHalaqah, MentorProgress } from '../routes/teacher/mentorTypes';
export type MentorWorkspace = {
    halaqahs: MentorHalaqah[];
    enrollments: MentorEnrollment[];
    lessons: (TeachingLesson & {
        program_id: string;
    })[];
    progress: MentorProgress[];
    today: number;
};
export function mentorLearning(e: MentorEnrollment, data: MentorWorkspace) {
    const lessons = data.lessons.filter(l => l.program_id === e.program_id);
    const result = teachingProgress({ ...e, class_id: null }, lessons, data.progress.map(p => ({ ...p, completed_at: null })));
    const available = new Set(lessons.filter(l => l.visibility_status === 'published' && (!l.release_at || Date.parse(l.release_at) <= Date.now())).map(l => l.id));
    const started = data.progress.some(p => p.enrollment_id === e.id && available.has(p.lesson_id));
    return { ...result, learningStatus: result.percent === 100 ? 'completed' : started ? 'in_progress' : 'not_started' };
}
async function readMentor(user: string, signal: AbortSignal): Promise<MentorWorkspace> {
    const halaqahs = await teachingRows<MentorHalaqah>(o => supabase.from('halaqahs').select('id,code,name,capacity,status,classes(id,code,name,program_id,programs(id,code,name,syllabus))').eq('mentor_user_id', user).eq('status', 'active').order('id').range(o, o + 499).abortSignal(signal));
    const result: MentorWorkspace = { halaqahs, enrollments: [], lessons: [], progress: [], today: 0 };
    for (let i = 0; i < halaqahs.length; i += 100) {
        const ids = halaqahs.slice(i, i + 100).map(h => h.id);
        const [enrollments, today] = await Promise.all([
            teachingRows<MentorEnrollment>(o => supabase.from('enrollments').select('id,halaqah_id,program_id,enrollment_number,enrollment_status,participants(id,display_name,global_participant_number,city)').in('halaqah_id', ids).eq('enrollment_status', 'active').order('id').range(o, o + 499).abortSignal(signal)),
            supabase.from('quran_submissions').select('id', { count: 'exact', head: true }).in('halaqah_id', ids).eq('assessment_date', wibDateKey(new Date().toISOString())).abortSignal(signal)
        ]);
        if (today.error)
            throw today.error;
        result.enrollments.push(...enrollments);
        result.today += today.count ?? 0;
    }
    const programs = [...new Set(halaqahs.map(h => h.classes?.program_id).filter((id): id is string => !!id))];
    const modules: {
        id: string;
        program_id: string;
    }[] = [];
    for (let i = 0; i < programs.length; i += 100)
        modules.push(...await teachingRows<{
            id: string;
            program_id: string;
        }>(o => supabase.from('program_modules').select('id,program_id').in('program_id', programs.slice(i, i + 100)).order('id').range(o, o + 499).abortSignal(signal)));
    const map = new Map(modules.map(m => [m.id, m.program_id]));
    for (let i = 0; i < modules.length; i += 100) {
        const lessons = await teachingRows<TeachingLesson>(o => supabase.from('lessons').select('id,module_id,visibility_status,release_at').in('module_id', modules.slice(i, i + 100).map(m => m.id)).order('id').range(o, o + 499).abortSignal(signal));
        result.lessons.push(...lessons.map(l => ({ ...l, program_id: map.get(l.module_id)! })));
    }
    for (let i = 0; i < result.enrollments.length; i += 100)
        result.progress.push(...await teachingRows<MentorProgress>(o => supabase.from('lesson_progresses').select('enrollment_id,lesson_id,status').in('enrollment_id', result.enrollments.slice(i, i + 100).map(e => e.id)).order('id').range(o, o + 499).abortSignal(signal)));
    return result;
}
export function useMentorWorkspace() {
    const { user } = useAuthSession(), id = user?.id, request = useRef<AbortController | null>(null);
    const [record, setRecord] = useState<{
        user: string;
        data: MentorWorkspace;
    } | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
    const load = useCallback(async () => { request.current?.abort(); if (!id) {
        setLoading(false);
        return;
    } const c = new AbortController(); request.current = c; setLoading(true); setError(''); try {
        const data = await readMentor(id, c.signal);
        if (!c.signal.aborted)
            setRecord({ user: id, data });
    }
    catch {
        if (!c.signal.aborted) {
            setRecord(null);
            setError('Data pendampingan belum dapat dimuat. Coba lagi atau hubungi pengelola.');
        }
    }
    finally {
        if (!c.signal.aborted)
            setLoading(false);
    } }, [id]);
    useEffect(() => { void load(); return () => request.current?.abort(); }, [load]);
    return { data: record?.user === id ? record?.data : null, loading, error, load };
}
