import type { PropsWithChildren } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Wallet, LifeBuoy, ShieldCheck, UserRound, Megaphone } from 'lucide-react';
import { useAuthSession } from '../../app/providers/authSessionContext';
import { Button } from '../../components/ui/button';
import { usePortalRead } from '../../lib/usePortalRead';
import type { HelpdeskList } from '../../lib/helpdeskWorkspace';
import { LearnerLoadState, LearnerRefresh } from '../../components/learner/LearnerShared';
import { AnnouncementHighlights } from './AnnouncementInboxPage';
export function ContentAccessPage() { return <div className="student-workspace"><header className="student-page-heading"><h1>Akses review konten</h1></header><section className="student-panel space-y-3"><ShieldCheck className="text-primary"/><h2 className="font-bold">Penerbitan melalui superadmin</h2><p className="text-sm text-muted-foreground">Penugasan reviewer belum terhubung ke layanan moderasi. Hubungi pengelola untuk tindak lanjut materi.</p><Button asChild><Link to="/admin/bantuan?category=academic">Hubungi pengelola<ArrowRight size={16}/></Link></Button></section></div>; }
export function StaffHomePage({ children }: PropsWithChildren) {
    const { primaryRole } = useAuthSession();
    return ['finance', 'helpdesk', 'content_reviewer'].includes(primaryRole ?? '') ? <StaffWorkspace /> : children;
}
function StaffWorkspace() {
    const { primaryRole, profile } = useAuthSession(), finance = primaryRole === 'finance', reviewer = primaryRole === 'content_reviewer';
    const queue = usePortalRead<HelpdeskList>('helpdesk_list', { p_view: 'staff', p_filters: {}, p_offset: 0, p_limit: 3 }, !reviewer);
    const href = finance ? '/admin/keuangan?tab=transactions&status=pending' : reviewer ? '/admin/konten' : '/admin/helpdesk';
    const Icon = finance ? Wallet : reviewer ? ShieldCheck : LifeBuoy;
    return <div className="student-workspace"><header className="student-page-heading"><div><span>Assalamu’alaikum, {profile?.full_name || 'Rekan YPIA'}</span><h1>{finance ? 'Ruang Keuangan' : reviewer ? 'Ruang Reviewer' : 'Ruang Layanan'}</h1></div>{!reviewer && <LearnerRefresh loading={queue.loading} onClick={() => void queue.load()}/>}</header><section className="student-continue"><div><span className="student-eyebrow"><Icon size={16}/>FOKUS HARI INI</span><h2>{finance ? 'Verifikasi pembayaran' : reviewer ? 'Koordinasi materi belajar' : 'Bantu peserta kembali belajar'}</h2><div className="student-continue-actions"><Button asChild><Link to={href}>{finance ? 'Buka pembayaran' : reviewer ? 'Periksa akses review' : 'Buka antrean tiket'}<ArrowRight size={16}/></Link></Button></div></div></section>
 {!reviewer && (queue.error ? <LearnerLoadState error={queue.error} loading={queue.loading} onRetry={() => void queue.load()}/> : <section className="student-metrics">{[{ key: 'active', label: 'Tiket aktif', query: '' }, { key: 'unassigned', label: 'Belum ditugaskan', query: 'assignment=unassigned' }, { key: 'waiting', label: 'Menunggu pelapor', query: 'status=waiting_reporter' }].map((m, i) => <Link className={'student-metric student-color-' + i} key={m.key} to={'/admin/helpdesk?' + m.query}><LifeBuoy size={20}/><div><strong>{queue.loading ? '…' : queue.data?.stats[m.key as keyof HelpdeskList['stats']] ?? '—'}</strong><span>{m.label}</span></div><ArrowRight size={15}/></Link>)}</section>)}
 <section className="student-panel"><div className="student-section-heading"><h2>Akses cepat</h2></div><div className="grid gap-3 sm:grid-cols-2">{(finance ? [{ label: 'Tagihan kelas', href: '/admin/keuangan?tab=invoices', Icon: Wallet }, { label: 'Rekening & QR', href: '/admin/keuangan?tab=channels', Icon: Wallet }] : []).concat([{ label: 'Pengumuman', href: '/admin/informasi', Icon: Megaphone }, { label: 'Profil & keamanan', href: '/admin/profil', Icon: UserRound }]).map(a => <Link className="flex items-center gap-3 rounded-lg border p-4 hover:bg-muted/50" key={a.href} to={a.href}><a.Icon size={18}/><span className="flex-1">{a.label}</span><ArrowRight size={15}/></Link>)}</div></section><AnnouncementHighlights /></div>;
}
