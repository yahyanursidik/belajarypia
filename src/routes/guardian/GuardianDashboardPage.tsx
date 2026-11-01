import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, BookOpen, CheckCheck, Users, MessageCircle, UserRound } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { LearnerLoadState, LearnerRefresh } from '../../components/learner/LearnerShared';
import { QuranHistory } from '../../components/companion/QuranHistory';
import { usePortalRead } from '../../lib/usePortalRead';
import { companionProgress, taskLabels, type GuardianWorkspace } from '../../lib/companionWorkspace';
import { learnerEnrollmentLabels } from '../../lib/learnerWorkspace';
import { userTime } from '../../lib/usersWorkspace';
import { AnnouncementHighlights } from '../shared/AnnouncementInboxPage';
export function GuardianDashboardPage() {
    const { data, loading, error, load } = usePortalRead<GuardianWorkspace>('guardian_learning_workspace');
    const [params, setParams] = useSearchParams();
    if (!data)
        return <div className="student-workspace"><header className="student-page-heading"><h1>Ruang Wali</h1></header><LearnerLoadState error={error} loading={loading} onRetry={() => void load()}/><Button asChild variant="outline"><Link to="/learner/bantuan?category=account">Bantuan akun wali</Link></Button></div>;
    const selected = params.get('child'), child = data.children.find(c => c.id === selected) ?? (!selected ? data.children[0] : null), program = params.get('program');
    const enrollments = (child?.enrollments ?? []).filter(e => !program || e.program_id === program), summary = companionProgress(enrollments);
    return <div className="student-workspace">
 <header className="student-page-heading"><div><span>PENDAMPINGAN BELAJAR</span><h1>Ruang Wali</h1></div><LearnerRefresh loading={loading} onClick={() => void load()}/></header>
 <section className="student-continue"><div><span className="student-eyebrow"><Users size={16}/>TUMBUH BERSAMA</span><h2>{child ? `Perjalanan belajar ${child.name}` : 'Hubungkan anak Anda'}</h2><p>{child ? 'Pantau progres, tugas, dan latihan berikutnya.' : 'Minta pengelola menautkan akun wali ke peserta.'}</p><div className="student-continue-actions"><Button asChild><a href={child ? '#perkembangan' : '/learner/bantuan?category=account'}>{child ? 'Lihat perkembangan' : 'Hubungi pengelola'}<ArrowRight size={16}/></a></Button><Link to="/learner/profil"><UserRound size={15}/>Profil wali</Link></div></div><div className="student-continue-progress"><span>{summary.percent === null ? '—' : summary.percent + '%'}</span><strong>{summary.completed}/{summary.total} materi tersedia selesai</strong><Progress value={summary.percent ?? 0} aria-label="Progres anak pilihan"/></div></section>
 {!!data.children.length && <section className="student-panel"><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm font-medium">Anak<select className="field-control w-full" value={child?.id ?? ''} onChange={e => setParams({ child: e.target.value })}>{!child && <option value="">Pilih anak</option>}{data.children.map(c => <option key={c.id} value={c.id}>{c.name} · {c.number}</option>)}</select></label><label className="space-y-1 text-sm font-medium">Program<select className="field-control w-full" value={program ?? ''} onChange={e => setParams(p => { const n = new URLSearchParams(p); if (e.target.value)
        n.set('program', e.target.value);
    else
        n.delete('program'); return n; })}><option value="">Semua program</option>{(child?.enrollments ?? []).map(e => <option key={e.id} value={e.program_id}>{e.program_name}</option>)}</select></label></div></section>}
 {selected && !child && <p role="alert" className="student-error">Anak tidak tersedia untuk akun ini. Pilih anak yang terhubung.</p>}
 <div className="student-metrics">{[{ label: 'Anak terhubung', value: data.children.length, Icon: Users }, { label: 'Program dibagikan', value: enrollments.length, Icon: BookOpen }, { label: 'Materi selesai', value: summary.completed, Icon: CheckCheck }].map(({ label, value, Icon }, i) => <div className={'student-metric student-color-' + i} key={label}><Icon size={20}/><div><strong>{value}</strong><span>{label}</span></div></div>)}</div>
 <section id="perkembangan" className="space-y-4 scroll-mt-20"><div className="student-section-heading"><h2>Perkembangan anak</h2><Link to="/learner/pengumuman">Pengumuman<ArrowRight size={14}/></Link></div>
 {!enrollments.length && <div className="student-panel"><p>{child ? 'Belum ada program yang dibagikan untuk pilihan ini.' : 'Belum ada data anak yang dapat ditampilkan.'}</p><Button asChild variant="outline" className="mt-3"><Link to="/learner/bantuan?category=academic">Bantuan pendampingan</Link></Button></div>}
 {enrollments.map(e => {
            const progress = companionProgress([e]);
            return <article className="student-panel space-y-4" key={e.id}><header className="flex flex-wrap items-start justify-between gap-3"><div><small className="text-muted-foreground">{e.number} · {learnerEnrollmentLabels[e.status] ?? e.status}</small><h2 className="text-lg font-bold">{e.program_name}</h2><p className="text-sm text-muted-foreground">{[e.class_name, e.halaqah_name].filter(Boolean).join(' · ') || 'Penempatan belum tersedia'}</p></div><strong>{progress.percent === null ? '—' : progress.percent + '%'}</strong></header><Progress value={progress.percent ?? 0} aria-label={'Progres ' + e.program_name}/><p className="text-xs text-muted-foreground">{e.completed}/{e.total} materi tersedia selesai</p>
 <details open><summary className="cursor-pointer font-semibold">Tugas & tenggat ({e.task_total})</summary><div className="mt-3 space-y-2">{!e.tasks.length && <p className="text-sm text-muted-foreground">Belum ada tugas terbit.</p>}{e.tasks.map(t => <div className="flex flex-wrap justify-between gap-2 rounded-lg border p-3" key={t.id}><div><strong className="text-sm">{t.title}</strong><p className="text-xs text-muted-foreground">{t.due_at ? userTime(t.due_at) : 'Tanpa tenggat'}</p></div><span className={'student-status student-status-' + (t.status === 'accepted' ? 'active' : t.status === 'needs_revision' ? 'hold' : 'pending')}>{taskLabels[t.status] ?? t.status}{t.score != null ? ' · ' + t.score + '/100' : ''}</span></div>)}{e.task_total > e.tasks.length && <p className="text-xs text-muted-foreground">Menampilkan {e.tasks.length} dari {e.task_total} tugas menurut tenggat terdekat.</p>}</div></details>
 {!!e.quran.length && <details><summary className="cursor-pointer font-semibold">Setoran Qur’an · 5 catatan terakhir</summary><div className="mt-3"><QuranHistory rows={e.quran}/></div></details>}
 <Link className="student-panel-link" to={`/learner/bantuan?category=academic&contextProgram=${e.program_id}&contextEnrollment=${e.id}`}><MessageCircle size={16}/>Tanyakan perkembangan<ArrowRight size={14}/></Link></article>;
        })}
 </section><AnnouncementHighlights /><small className="student-snapshot">Data {userTime(data.generated_at)}</small></div>;
}
