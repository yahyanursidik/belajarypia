import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import type { Enrollment } from '../../lib/enrollment';
import { fetchLearningSummary } from '../../lib/learningSummary';

function LearningCard({ enrollment }: { enrollment: Enrollment }) {
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof fetchLearningSummary>> | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setSummary(null); setFailed(false);
    void fetchLearningSummary(enrollment.program_id, enrollment.id, controller.signal).then((data) => {
      if (!controller.signal.aborted) setSummary(data);
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [enrollment.id, enrollment.program_id, retry]);
  const programPath = `/learner/program/${enrollment.program_id}`;
  return <article className="learner-learning-card">
    <span className="learner-learning-card__icon">{summary?.finished ? <CheckCircle2 size={22} /> : <BookOpen size={22} />}</span>
    <h3>{enrollment.programs?.name ?? 'Program belajar'}</h3>
    {summary ? <>
      <div className="learner-learning-card__progress"><span>{summary.completed}/{summary.total} materi selesai</span><strong>{summary.percent}%</strong></div>
      <Progress value={summary.percent} aria-label="Progres program" />
      <p>{summary.finished ? 'Seluruh materi selesai.' : summary.next ? summary.next.title : 'Materi berikutnya belum tersedia.'}</p>
      <Button asChild><Link to={summary.finished ? `/learner/transkrip/${enrollment.id}` : summary.next ? `/learner/lesson/${summary.next.id}` : programPath}>{summary.finished ? 'Lihat hasil' : summary.next ? summary.completed ? 'Lanjutkan belajar' : 'Mulai belajar' : 'Buka program'}<ArrowRight size={16} /></Link></Button>
    </> : failed ? <><p role="status">Progres belum dapat dimuat.</p><Button variant="outline" onClick={() => setRetry((v) => v + 1)}>Coba lagi</Button></> : <p role="status">Memuat progres…</p>}
    <Link className="learner-text-link" to={programPath}>Semua materi</Link>
  </article>;
}

export function LearningCards({ enrollments }: { enrollments: Enrollment[] }) {
  return enrollments.length ? <div className="learner-learning-grid">{enrollments.map((enrollment) => <LearningCard key={enrollment.id} enrollment={enrollment} />)}</div>
    : <div className="learner-empty"><BookOpen size={28} /><h3>Belum ada program aktif</h3><Button asChild variant="outline"><Link to="/learner/cek-status">Cek pendaftaran</Link></Button></div>;
}
