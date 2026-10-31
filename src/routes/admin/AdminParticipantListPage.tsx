import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Users, UserCheck, BookOpen, KeyRound, Plus, Upload, Search, RefreshCw, ArrowRight, Settings, FileText, ClipboardList, LayoutDashboard, Database } from 'lucide-react';
import { PageHeader } from '../../components/admin/PageHeader';
import { SectionNav } from '../../components/admin/SectionNav';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { EmptyState } from '../../components/ui/empty-state';
import { ParticipantCreateDialog } from '../../components/participants/ParticipantCreateDialog';
import { ParticipantImportDialog } from '../../components/participants/ParticipantImportDialog';
import { ParticipantTranscriptDialog } from '../../components/participants/ParticipantTranscriptDialog';
import { ParticipantAccessDialog } from '../../components/participants/ParticipantAccessDialog';
import { safeParticipantSearch, participantPage, type ParticipantProgram } from '../../lib/participantDirectory';
import type { Participant } from '../../lib/participant';
import { supabase } from '../../lib/supabase';

type ParticipantRow = Omit<Participant, 'profiles'> & {
  profiles: { email: string | null; phone: string | null; full_name: string | null } | null;
  enrollments: { id: string; program_id: string; enrollment_status: string; programs: { name: string; code: string } | null }[];
};
type Tab = 'directory' | 'overview' | 'operations';
const tabs = [{key:'directory' as const,label:'Daftar peserta',icon:ClipboardList},{key:'overview' as const,label:'Ringkasan',icon:LayoutDashboard},{key:'operations' as const,label:'Alat & dokumen',icon:Database}];
const statusLabels: Record<string,string> = { active:'Aktif',inactive:'Tidak aktif',archived:'Diarsipkan' };
const pageSize = 20;

export function AdminParticipantListPage() {
  const location = useLocation(); const basePath = location.pathname.startsWith('/system') ? '/system' : '/admin';
  const [params, setParams] = useSearchParams();
  const tab: Tab = ['directory','overview','operations'].includes(params.get('tab') ?? '') ? params.get('tab') as Tab : 'directory';
  const status = ['active','inactive','archived'].includes(params.get('status') ?? '') ? params.get('status')! : 'all';
  const program = params.get('program') || 'all';
  const attention = ['no-account','no-program'].includes(params.get('attention') ?? '') ? params.get('attention')! : 'all';
  const page = participantPage(params.get('page'));
  const query = params.get('q') ?? '';
  const [search, setSearch] = useState(query);
  const [rows, setRows] = useState<ParticipantRow[]>([]); const [total, setTotal] = useState(0);
  const [programs, setPrograms] = useState<ParticipantProgram[]>([]); const [programsLoading,setProgramsLoading] = useState(true); const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(''); const [programError, setProgramError] = useState(''); const [statsError, setStatsError] = useState(false);
  const [stats, setStats] = useState<(number | null)[]>([null,null,null,null]);
  const [reload, setReload] = useState(0); const [dialog, setDialog] = useState<'create'|'import'|'transcript'|null>(null);
  const [access, setAccess] = useState<ParticipantRow | null>(null); const [createdId, setCreatedId] = useState<string>();
  const [notice, setNotice] = useState('');
  function patch(values: Record<string,string | null>, replace = false) {
    setParams((current) => { const next = new URLSearchParams(current); for (const [key,value] of Object.entries(values)) { if (value === null || value === 'all' || value === '') next.delete(key); else next.set(key,value); } return next; }, {replace});
  }
  useEffect(() => { setSearch(query); }, [query]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== query) setParams((current) => { const next = new URLSearchParams(current); if (search.trim()) next.set('q',search.trim()); else next.delete('q'); next.delete('page'); return next; }, {replace:true});
    }, 350);
    return () => clearTimeout(timer);
  }, [search, query, setParams]);
  useEffect(() => {
    const controller = new AbortController();
    setProgramError(''); setProgramsLoading(true);
    void supabase.from('programs').select('id,name,code,status').order('name').abortSignal(controller.signal).then(({data,error}) => {
      if (controller.signal.aborted) return;
      if (error) { setProgramError('Daftar program belum tersedia. Coba muat ulang.'); setPrograms([]); } else setPrograms((data ?? []) as ParticipantProgram[]); setProgramsLoading(false);
    });
    return () => controller.abort();
  }, [reload]);
  useEffect(() => {
    const controller = new AbortController(); setStatsError(false); setStats([null,null,null,null]);
    const requests = [
      supabase.from('participants').select('id',{count:'exact',head:true}),
      supabase.from('participants').select('id',{count:'exact',head:true}).eq('status','active'),
      supabase.from('participants').select('id',{count:'exact',head:true}).is('user_id',null),
      supabase.from('participants').select('id,enrollments(id)',{count:'exact',head:true}).eq('enrollments.enrollment_status','active').is('enrollments',null),
    ];
    void Promise.all(requests.map((request) => request.abortSignal(controller.signal))).then((results) => {
      if (controller.signal.aborted) return;
      setStats(results.map((result) => result.error ? null : result.count)); setStatsError(results.some((result) => Boolean(result.error)));
    });
    return () => controller.abort();
  }, [reload]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setListError(''); setRows([]);
    const inner = program !== 'all' && attention !== 'no-program';
    let request = supabase.from('participants').select(`*,profiles(full_name,email,phone),enrollments${inner ? '!inner' : ''}(id,program_id,enrollment_status,programs(name,code))`,{count:'exact'}).eq('enrollments.enrollment_status','active');
    if (program !== 'all' && attention !== 'no-program') request = request.eq('enrollments.program_id',program);
    if (status !== 'all') request = request.eq('status',status);
    if (attention === 'no-account') request = request.is('user_id',null);
    if (attention === 'no-program') request = request.is('enrollments',null);
    const term = safeParticipantSearch(query);
    if (term) request = request.or(`display_name.ilike.%${term}%,global_participant_number.ilike.%${term}%`);
    void request.order('created_at',{ascending:false}).range((page-1)*pageSize,page*pageSize-1).abortSignal(controller.signal).then(({data,error,count}) => {
      if (controller.signal.aborted) return;
      if (error) { setListError('Data peserta belum dapat dimuat. Coba muat ulang.'); setTotal(0); }
      else {
        setRows((data ?? []) as unknown as ParticipantRow[]); setTotal(count ?? 0);
        const last = Math.max(1,Math.ceil((count ?? 0)/pageSize));
        if (page > last) setParams((current) => { const next = new URLSearchParams(current); next.set('page',String(last)); return next; }, {replace:true});
      }
      setLoading(false);
    });
    return () => controller.abort();
  }, [query,status,program,attention,page,reload,setParams]);
  const returnTo = `${location.pathname}${location.search}`;
  const detail = (id: string, section = 'overview') => `${basePath}/peserta/${id}?tab=${section}&returnTo=${encodeURIComponent(returnTo)}`;
  const metrics = [
    {title:'Semua peserta',icon:Users,tone:'blue',action:()=>patch({tab:'directory',status:null,attention:null,program:null,q:null,page:null})},
    {title:'Peserta aktif',icon:UserCheck,tone:'emerald',action:()=>patch({tab:'directory',status:'active',attention:null,program:null,q:null,page:null})},
    {title:'Belum ada akun',icon:KeyRound,tone:'amber',action:()=>patch({tab:'directory',attention:'no-account',status:null,program:null,q:null,page:null})},
    {title:'Tanpa program aktif',icon:BookOpen,tone:'violet',action:()=>patch({tab:'directory',attention:'no-program',status:null,program:null,q:null,page:null})},
  ];
  function saved(id?: string, message = 'Peserta tersimpan.') { setDialog(null); setReload((v)=>v+1); setCreatedId(id); setNotice(message); }
  return <div className="page-stack participants-workspace">
    <PageHeader title="Peserta" actions={<><Button variant="outline" onClick={()=>setReload((v)=>v+1)} aria-label="Muat ulang peserta"><RefreshCw size={16}/></Button><Button variant="outline" disabled={programsLoading || Boolean(programError)} onClick={()=>setDialog('import')}><Upload size={16}/>Impor CSV</Button><Button disabled={programsLoading || Boolean(programError)} onClick={()=>setDialog('create')}><Plus size={16}/>Tambah peserta</Button></>} />
    <div className="participant-metrics" aria-label="Ringkasan seluruh peserta">{metrics.map(({title,icon:Icon,tone,action},i)=><button key={title} onClick={action} className={`admin-stat admin-tone-${tone}`}><span className="admin-stat__icon"><Icon size={19}/></span><span><span className="admin-stat__label">{title}</span><strong>{stats[i] ?? '—'}</strong></span><ArrowRight size={15}/></button>)}</div>
    {statsError && <p role="status" className="text-sm text-muted-foreground">Sebagian ringkasan belum tersedia. Angka — tidak berarti nol.</p>}
    {programError && <p role="alert" className="participants-error">{programError}</p>}
    {notice && <div role="status" className="participant-result"><span>{notice}</span>{createdId && <Link to={detail(createdId)}>Buka detail peserta <ArrowRight size={14}/></Link>}<button onClick={()=>setNotice('')} aria-label="Tutup pemberitahuan">×</button></div>}
    <SectionNav items={tabs} value={tab} onChange={(tab)=>patch({tab})} label="Bagian peserta" />
    {tab === 'directory' && <section className="participant-directory" aria-label="Daftar peserta">
      <div className="participant-toolbar">
        <label className="participant-search"><Search size={17}/><Input placeholder="Cari nama atau nomor induk…" aria-label="Cari nama atau nomor induk" value={search} onChange={(e)=>setSearch(e.target.value)}/></label>
        <select aria-label="Filter status peserta" value={status} onChange={(e)=>patch({status:e.target.value,page:null})}><option value="all">Semua status</option>{Object.entries(statusLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>
        <select aria-label="Filter program aktif" value={program} onChange={(e)=>patch({program:e.target.value,attention:attention==='no-program'?null:attention,page:null})}><option value="all">Semua program aktif</option>{programs.map((p)=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select aria-label="Filter tindak lanjut" value={attention} onChange={(e)=>patch({attention:e.target.value,program:e.target.value==='no-program'?null:program,page:null})}><option value="all">Semua kondisi</option><option value="no-account">Belum ada akun</option><option value="no-program">Tanpa program aktif</option></select>
        {(query || status!=='all' || program!=='all' || attention!=='all') && <Button variant="ghost" onClick={()=>patch({q:null,status:null,program:null,attention:null,page:null})}>Hapus filter</Button>}
      </div>
      {loading ? <p className="participant-loading" role="status">Memuat peserta…</p> : listError ? <div className="participant-loading"><p role="alert">{listError}</p><Button variant="outline" onClick={()=>setReload((v)=>v+1)}>Coba lagi</Button></div> : !rows.length ? <EmptyState title="Peserta tidak ditemukan" description="Sesuaikan filter atau tambahkan peserta baru." className="border-0"/> : <div className="participant-table-wrap"><table className="participant-table"><thead><tr><th>Peserta</th><th>Kontak</th><th>Program aktif</th><th>Akun & tindak lanjut</th><th><span className="sr-only">Aksi</span></th></tr></thead><tbody>{rows.map((row)=><tr key={row.id}>
        <td data-label="Peserta"><Link className="participant-name" to={detail(row.id)}>{row.display_name}</Link><div className="participant-meta"><span>{row.global_participant_number}</span><span className={`participant-status status-${row.status}`}>{statusLabels[row.status] ?? row.status}</span></div></td>
        <td data-label="Kontak"><span>{row.profiles?.email || 'Email belum diisi'}</span><small>{row.profiles?.phone || row.phone || 'Telepon belum diisi'}{row.city ? ` · ${row.city}` : ''}</small></td>
        <td data-label="Program aktif">{row.enrollments?.length ? <div className="participant-program-links">{row.enrollments.map((e)=><Link key={e.id} to={`${basePath}/program/${e.program_id}/peserta`}>{e.programs?.name || 'Buka program'}</Link>)}</div> : <Link className="participant-followup" to={detail(row.id,'academic')}>Tentukan program <ArrowRight size={13}/></Link>}</td>
        <td data-label="Akun & tindak lanjut"><span className={`participant-status ${row.user_id?'status-active':'status-pending'}`}>{row.user_id?'Akun terhubung':'Belum ada akun'}</span><div className="participant-inline-actions"><Link to={detail(row.id,'academic')}>Akademik & transkrip</Link>{row.participant_type==='child' && <Link to={detail(row.id,'guardians')}>Wali</Link>}</div></td>
        <td data-label="Aksi"><div className="participant-row-actions"><Button variant="ghost" size="icon" disabled={!row.user_id} onClick={()=>setAccess(row)} aria-label={`Kelola akses ${row.display_name}`} title={row.user_id?'Kelola akses':'Akun belum terhubung'}><KeyRound size={16}/></Button><Button asChild variant="outline" size="sm"><Link to={detail(row.id)}>Detail</Link></Button></div></td>
      </tr>)}</tbody></table></div>}
      {!loading && !listError && <footer className="participant-pagination"><span>{total?`${(page-1)*pageSize+1}–${Math.min(page*pageSize,total)}`:'0'} dari {total} peserta</span><div><Button variant="outline" size="sm" disabled={page===1} onClick={()=>patch({page:String(page-1)})}>Sebelumnya</Button><span>{page} / {Math.max(1,Math.ceil(total/pageSize))}</span><Button variant="outline" size="sm" disabled={page*pageSize>=total} onClick={()=>patch({page:String(page+1)})}>Selanjutnya</Button></div></footer>}
    </section>}
    {tab==='overview' && <div className="participant-tools-grid"><article><h2>Tindak lanjut</h2><button onClick={metrics[2].action}><KeyRound/>Periksa akun peserta<ArrowRight/></button><button onClick={metrics[3].action}><BookOpen/>Lengkapi program aktif<ArrowRight/></button><Link to={`${basePath}/pendaftaran?tab=review`}><ClipboardList/>Tinjau pendaftar baru<ArrowRight/></Link></article><article><h2>Alur peserta</h2><ol className="participant-flow"><li>Pendaftaran</li><li>Profil & akun</li><li>Program & kelas</li><li>Nilai & transkrip</li></ol><Button variant="outline" onClick={()=>patch({tab:'directory'})}>Buka daftar peserta</Button></article></div>}
    {tab==='operations' && <div className="participant-tools-grid"><article><h2>Data peserta</h2><button disabled={programsLoading || Boolean(programError)} onClick={()=>setDialog('create')}><Plus/>Tambah peserta<ArrowRight/></button><button disabled={programsLoading || Boolean(programError)} onClick={()=>setDialog('import')}><Upload/>Impor & hasil per baris<ArrowRight/></button><Link to={`${basePath}/pendaftaran?tab=review`}><ClipboardList/>Pendaftaran & seleksi<ArrowRight/></Link></article><article><h2>Dokumen & akses</h2><button onClick={()=>setDialog('transcript')}><Settings/>Template transkrip<ArrowRight/></button><button onClick={()=>patch({tab:'directory'})}><FileText/>Pilih peserta untuk transkrip<ArrowRight/></button>{basePath==='/system' && <Link to="/system/pengguna"><KeyRound/>Kelola akun & peran<ArrowRight/></Link>}</article></div>}
    {dialog==='create' && <ParticipantCreateDialog programs={programs} onClose={()=>setDialog(null)} onSaved={saved}/>}
    {dialog==='import' && <ParticipantImportDialog basePath={basePath} programs={programs} onClose={()=>setDialog(null)} onSaved={()=>{setReload((v)=>v+1);}}/>}
    {dialog==='transcript' && <ParticipantTranscriptDialog onClose={()=>setDialog(null)}/>}
    {access && <ParticipantAccessDialog participant={access} onClose={()=>setAccess(null)}/>}
  </div>;
}
