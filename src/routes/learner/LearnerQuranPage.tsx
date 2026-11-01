import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { QuranHistory } from '../../components/companion/QuranHistory';
import { LearnerLoadState, LearnerRefresh } from '../../components/learner/LearnerShared';
import { useLearnerPortal } from '../../lib/learnerData';
import { usePortalRead } from '../../lib/usePortalRead';
import type { QuranRecord } from '../../lib/companionWorkspace';
export function LearnerQuranPage() {
    const portal = useLearnerPortal(), [params, setParams] = useSearchParams();
    const enrollments = (portal.data?.enrollments ?? []).filter(e => ['active', 'completed'].includes(e.enrollment_status) && e.programs?.feature_flags?.use_quran_engine);
    const requested = params.get('enrollment'), selected = enrollments.find(e => e.id === requested) ?? (!requested ? enrollments[0] : undefined);
    const raw = Number(params.get('page')), page = Number.isSafeInteger(raw) && raw > 0 ? raw : 1;
    const history = usePortalRead<{
        rows: QuranRecord[];
        total: number;
        page: number;
    }>('learner_quran_history', { p_enrollment: selected?.id ?? null, p_page: page }, !!selected);
    if (!portal.data)
        return <LearnerLoadState error={portal.error} loading={portal.loading} onRetry={() => void portal.load()}/>;
    return <div className="student-workspace"><header className="student-page-heading"><div><span>HASIL PENDAMPINGAN</span><h1>Perjalanan Qur’an</h1></div><LearnerRefresh loading={history.loading || portal.loading} onClick={() => { void portal.load(); void history.load(); }}/></header>
 <section className="student-continue"><div><span className="student-eyebrow"><BookOpen size={16}/>SELANGKAH LEBIH LANCAR</span><h2>Catatan setoran & latihan</h2><p>Lihat umpan balik musyrif dan target berikutnya.</p></div></section>
 {portal.error && <LearnerLoadState error={portal.error} loading={portal.loading} onRetry={() => void portal.load()}/>}
 <label className="space-y-2 text-sm font-medium">Program<select className="field-control w-full" value={selected?.id ?? ''} onChange={e => setParams({ enrollment: e.target.value })}>{!selected && <option value="">Pilih program Qur’an</option>}{enrollments.map(e => <option value={e.id} key={e.id}>{e.programs?.name} · {e.enrollment_number}</option>)}</select></label>
 {!selected ? <section className="student-panel"><p>{requested ? 'Kepesertaan ini tidak tersedia. Pilih program Anda.' : 'Belum ada program Qur’an yang tersedia untuk akun ini.'}</p><Button asChild variant="outline" className="mt-3"><Link to="/learner/bantuan?category=academic">Bantuan belajar</Link></Button></section> : <>
 <div className="flex flex-wrap gap-3"><Button asChild variant="outline"><Link to={'/learner/program/' + selected.program_id}><ArrowLeft size={15}/>Program</Link></Button><Button asChild variant="outline"><Link to={`/learner/bantuan?category=academic&contextProgram=${selected.program_id}&contextEnrollment=${selected.id}`}>Tanyakan catatan</Link></Button></div>
 {!history.data ? <LearnerLoadState error={history.error} loading={history.loading} onRetry={() => void history.load()}/> : <><QuranHistory rows={history.data.rows}/><div className="flex flex-wrap items-center justify-between gap-3"><small>{history.data.total} catatan · Halaman {history.data.page}/{Math.max(1, Math.ceil(history.data.total / 10))}</small><div className="flex gap-2">{[-1, 1].map(direction => <Button key={direction} variant="outline" disabled={history.loading || (direction < 0 ? history.data!.page <= 1 : history.data!.page * 10 >= history.data!.total)} onClick={() => setParams({ enrollment: selected.id, page: String(history.data!.page + direction) })}>{direction < 0 ? 'Sebelumnya' : 'Berikutnya'}</Button>)}</div></div></>}
 </>}
 </div>;
}
