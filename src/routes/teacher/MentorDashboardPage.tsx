import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Users, CheckCheck } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { useAuthSession } from '../../app/providers/authSessionContext';
import { useMentorWorkspace, mentorLearning } from '../../lib/mentorData';
import { companionProgress } from '../../lib/companionWorkspace';
import { LearnerLoadState, LearnerRefresh } from '../../components/learner/LearnerShared';
import { AnnouncementHighlights } from '../shared/AnnouncementInboxPage';
export function MentorDashboardPage() {
    const { profile } = useAuthSession(), { data, loading, error, load } = useMentorWorkspace();
    if (!data)
        return <LearnerLoadState error={error} loading={loading} onRetry={() => void load()}/>;
    const summary = companionProgress(data.enrollments.map(e => mentorLearning(e, data)));
    return <div className="student-workspace"><header className="student-page-heading"><div><span>Assalamu’alaikum, {profile?.full_name || 'Musyrif'}</span><h1>Ruang Pendampingan</h1></div><LearnerRefresh loading={loading} onClick={() => void load()}/></header>
 <section className="student-continue"><div><span className="student-eyebrow"><BookOpen size={16}/>FOKUS PENDAMPINGAN</span><h2>Kenali progres setiap binaan</h2><div className="student-continue-actions"><Button asChild><Link to="/teacher/quran">Catat setoran<ArrowRight size={16}/></Link></Button><Link to="/teacher/halaqah">Lihat perkembangan</Link></div></div><div className="student-continue-progress"><span>{summary.percent === null ? '—' : summary.percent + '%'}</span><strong>{summary.completed}/{summary.total} materi peserta selesai</strong><Progress value={summary.percent ?? 0}/></div></section>
 <div className="student-metrics">{[{ label: 'Halaqah aktif', value: data.halaqahs.length, Icon: Users, href: '/teacher/halaqah' }, { label: 'Kepesertaan aktif', value: data.enrollments.length, Icon: Users, href: '/teacher/halaqah' }, { label: 'Setoran hari ini · WIB', value: data.today, Icon: CheckCheck, href: '/teacher/quran' }].map(({ label, value, Icon, href }, i) => <Link className={'student-metric student-color-' + i} key={label} to={href}><Icon size={20}/><div><strong>{value}</strong><span>{label}</span></div><ArrowRight size={15}/></Link>)}</div>
 <section className="space-y-3"><div className="student-section-heading"><h2>Halaqah dampingan</h2><Link to="/teacher/halaqah">Lihat semua<ArrowRight size={14}/></Link></div>{!data.halaqahs.length && <div className="student-panel"><p>Belum ada penugasan halaqah aktif.</p><Link className="student-panel-link" to="/teacher/bantuan?category=academic">Hubungi pengelola</Link></div>}{data.halaqahs.map(h => <article className="student-panel" key={h.id}><small>{h.classes?.programs?.name}</small><h3 className="font-bold text-lg">{h.name}</h3><p className="text-sm text-muted-foreground">{h.classes?.name} · {data.enrollments.filter(e => e.halaqah_id === h.id).length} kepesertaan</p><div className="mt-3 flex flex-wrap gap-2"><Button asChild variant="outline"><Link to={'/teacher/halaqah?halaqah=' + h.id}>Progres binaan</Link></Button><Button asChild><Link to={'/teacher/quran?halaqah=' + h.id}>Setoran<ArrowRight size={15}/></Link></Button></div></article>)}</section><AnnouncementHighlights />
 </div>;
}
