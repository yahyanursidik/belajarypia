import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthSession } from '../app/providers/authSessionContext';
import { supabase } from './supabase';
import { companionError } from './companionWorkspace';
export function usePortalRead<T>(name: string, args: Record<string, unknown> = {}, enabled = true) {
    const { user } = useAuthSession(), id = user?.id, key = JSON.stringify(args), request = useRef<AbortController | null>(null);
    const [record, setRecord] = useState<{
        key: string;
        user: string;
        name: string;
        data: T;
    } | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
    const load = useCallback(async () => {
        request.current?.abort();
        if (!id || !enabled) {
            setLoading(false);
            return;
        }
        const c = new AbortController();
        request.current = c;
        setLoading(true);
        setError('');
        try {
            const r = await supabase.rpc(name, JSON.parse(key)).abortSignal(c.signal);
            if (r.error)
                throw r.error;
            if (r.data == null)
                throw new Error('Data belum tersedia.');
            if (!c.signal.aborted)
                setRecord({ key, user: id, name, data: r.data });
        }
        catch (e) {
            if (!c.signal.aborted) {
                setRecord(null);
                setError(companionError(e));
            }
        }
        finally {
            if (!c.signal.aborted)
                setLoading(false);
        }
    }, [id, key, name, enabled]);
    useEffect(() => { void load(); return () => request.current?.abort(); }, [load]);
    return { data: enabled && record?.user === id && record?.key === key && record?.name === name ? record.data : null, loading, error, load };
}
