import { BookOpen, Target } from 'lucide-react';
import { quranKinds, type QuranRecord } from '../../lib/companionWorkspace';
export function QuranHistory({ rows }: {
    rows: QuranRecord[];
}) {
    return <div className="space-y-3">{!rows.length ? <p className="student-empty-inline">Belum ada setoran yang dicatat musyrif.</p> : rows.map(r => <article key={r.id} className="rounded-xl border bg-background p-4 space-y-3">
 <div className="flex flex-wrap items-start justify-between gap-2"><div><small className="text-muted-foreground">{quranKinds[r.submission_type] ?? r.submission_type} · {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'Asia/Jakarta' }).format(new Date(r.assessment_date + 'T00:00:00+07:00'))}</small><h3 className="flex items-center gap-2 font-semibold"><BookOpen size={17}/>{r.surah_name}{r.ayah_from != null ? ` · ${r.ayah_from}${r.ayah_to != null ? '–' + r.ayah_to : ''}` : ''}</h3></div></div>
 <dl className="grid grid-cols-3 gap-2">{[['Kelancaran', r.fluency_score], ['Tajwid', r.tajwid_score], ['Hafalan', r.memorization_score]].map(([label, value]) => <div className="rounded-lg bg-muted/50 p-2" key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-bold">{value ?? '—'}</dd></div>)}</dl>
 {r.notes && <p className="whitespace-pre-wrap break-words text-sm">{r.notes}</p>}{r.next_target && <div className="rounded-lg bg-emerald-50 p-3 text-emerald-950"><strong className="flex items-center gap-2 text-sm"><Target size={15}/>Latihan berikutnya</strong><p className="mt-1 whitespace-pre-wrap break-words text-sm">{r.next_target}</p></div>}
 </article>)}</div>;
}
