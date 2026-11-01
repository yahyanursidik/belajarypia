import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, BookOpen, Search } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { LearnerLoadState, LearnerRefresh } from '../../components/learner/LearnerShared';
import { supabase } from '../../lib/supabase';
import { teachingRows } from '../../lib/teacherData';
import type { Program } from '../../lib/organization';
export function ProgramCatalogPage() {
    const [rows, setRows] = useState<Program[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [params, setParams] = useSearchParams(), q = params.get('q') ?? '';
    const load = useCallback(async (signal?: AbortSignal) => { setLoading(true); setError(''); try {
        const rows = await teachingRows<Program>(o => { const query = supabase.from('programs').select('id,code,name,description,delivery_mode,status').eq('status', 'active').order('id').range(o, o + 499); return signal ? query.abortSignal(signal) : query; });
        if (!signal?.aborted)
            setRows(rows);
    }
    catch {
        if (!signal?.aborted) {
            setRows([]);
            setError('Katalog belum dapat dimuat. Coba lagi.');
        }
    }
    finally {
        if (!signal?.aborted)
            setLoading(false);
    } }, []);
    useEffect(() => { const c = new AbortController(); void load(c.signal); return () => c.abort(); }, [load]);
    const filtered = rows.filter(p => (p.name + ' ' + p.code).toLowerCase().includes(q.toLowerCase())), raw = Number(params.get('page')), page = Math.min(Number.isSafeInteger(raw) && raw > 0 ? raw : 1, Math.max(1, Math.ceil(filtered.length / 12)));
    return <div className="student-workspace mx-auto max-w-6xl p-4 sm:p-8"><header className="student-page-heading"><div><span>YPIA · BELAJAR BERSAMA</span><h1>Temukan programmu</h1></div><LearnerRefresh loading={loading} onClick={() => void load()}/></header><div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/cek-status">Cek pendaftaran</Link></Button><Button asChild><Link to="/auth/login">Masuk portal<ArrowRight size={16}/></Link></Button></div><label className="flex items-center gap-2"><Search size={18}/><Input value={q} aria-label="Cari program" placeholder="Cari nama program…" onChange={e => setParams(e.target.value ? { q: e.target.value } : {})}/></label>
 {loading || error ? <LearnerLoadState loading={loading} error={error} onRetry={() => void load()}/> : <><div className="student-program-grid">{filtered.slice((page - 1) * 12, page * 12).map((p, i) => <article key={p.id} className={'student-panel border-t-4 ' + ['border-t-emerald-400', 'border-t-sky-400', 'border-t-amber-400'][i % 3]}><BookOpen className="mb-3 text-primary"/><small>{({ online: 'Daring', offline: 'Tatap muka', hybrid: 'Hybrid' } as Record<string, string>)[p.delivery_mode] ?? 'Program belajar'}</small><h2 className="mt-1 text-lg font-bold">{p.name}</h2>{p.description && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{p.description}</p>}<Link className="student-panel-link mt-4" to={'/katalog/' + p.id}>Lihat program<ArrowRight size={16}/></Link></article>)}</div>{!filtered.length && <section className="student-panel"><p>{q ? 'Program tidak ditemukan. Coba kata lain.' : 'Belum ada program yang ditampilkan.'}</p>{q && <Button variant="outline" className="mt-3" onClick={() => setParams({})}>Hapus pencarian</Button>}</section>}<div className="flex items-center justify-between gap-3"><small>{filtered.length} program · Halaman {page}</small><div className="flex gap-2">{[-1, 1].map(d => <Button key={d} variant="outline" disabled={d < 0 ? page <= 1 : page * 12 >= filtered.length} onClick={() => setParams({ q, page: String(page + d) })}>{d < 0 ? 'Sebelumnya' : 'Berikutnya'}</Button>)}</div></div></>}
 </div>;
}
