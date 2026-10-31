import { Link, useLocation, useSearchParams } from "react-router-dom";
import { ArrowUpRight, CalendarDays, Clock3, RefreshCw } from "lucide-react";
import { useAgenda } from "../../lib/agendaData";
import { agendaEvents, agendaMonth, agendaTarget } from "../../lib/agenda";
import { wibDateKey } from "../../lib/dateRange";
import { Button } from "../../components/ui/button";

const dateLabel = (day: string) => new Date(day + "T00:00:00+07:00").toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "long" });
export function AgendaPage() {
  const { pathname } = useLocation();
  const base = "/" + pathname.split("/")[1];
  const [params, setParams] = useSearchParams();
  const month = agendaMonth(params.get("month"));
  const program = params.get("program") ?? "all";
  const kind = params.get("kind") === "due" ? "due" : params.get("kind") === "release" ? "release" : "all";
  const { lessons, loading, error, reload } = useAgenda(base, month);
  const events = agendaEvents(lessons, month);
  const scoped = events.filter((e) => program === "all" || e.program_id === program);
  const visible = scoped.filter((e) => kind === "all" || e.kind === kind);
  const page = Math.min(Math.max(1, Math.floor(Number(params.get("page"))) || 1), Math.max(1, Math.ceil(visible.length / 30)));
  const paged = visible.slice((page - 1) * 30, page * 30);
  const days = [...new Set(paged.map((e) => e.day))];
  const programs = [...new Map(lessons.map((l) => [l.program_id, l.program_name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const today = wibDateKey(new Date().toISOString());
  const update = (key: string, value: string) => setParams((old) => {
    const next = new URLSearchParams(old); next.set(key, value);
    if (key !== "page") next.delete("page");
    return next;
  });
  return <div className="agenda-workspace">
    <header className="agenda-heading"><div><span>RILIS & TENGGAT MATERI</span><h1>Agenda {base === "/learner" ? "belajar" : "pembelajaran"}</h1></div><Button variant="outline" size="icon" aria-label="Muat ulang agenda" onClick={reload} disabled={loading}><RefreshCw size={18}/></Button></header>
    <div className="agenda-summary">
      <div><CalendarDays/><strong>{loading || error ? "—" : scoped.filter((e) => e.kind === "release").length}</strong><span>Rilis materi</span></div>
      <div><Clock3/><strong>{loading || error ? "—" : scoped.filter((e) => e.kind === "due").length}</strong><span>Batas waktu</span></div>
      <div><strong>WIB</strong><span>Waktu Indonesia Barat</span><Button variant="outline" size="sm" onClick={() => { setParams({ month: today.slice(0, 7) }); }}>Bulan ini</Button></div>
    </div>
    <section className="agenda-filters" aria-label="Filter agenda">
      <label>Bulan<input type="month" value={month} onInput={(e) => { if (e.currentTarget.value) update("month", e.currentTarget.value); }}/></label>
      <label>Program<select value={program} onChange={(e) => update("program", e.target.value)}><option value="all">Semua program</option>{program !== "all" && !programs.some(([id]) => id === program) && <option value={program}>Program terpilih</option>}{programs.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label>Kegiatan<select value={kind} onChange={(e) => update("kind", e.target.value)}><option value="all">Semua kegiatan</option><option value="release">Rilis materi</option><option value="due">Batas waktu</option></select></label>
    </section>
    {loading ? <p role="status" className="agenda-empty">Memuat agenda…</p> : error ? <div role="alert" className="agenda-empty">{error}<Button variant="outline" onClick={reload}>Coba lagi</Button></div> : !visible.length ? <div className="agenda-empty"><CalendarDays size={32}/><h2>Belum ada agenda pada filter ini</h2><p>Jadwal muncul dari materi terbit yang memiliki tanggal rilis atau batas waktu.</p><Button variant="outline" asChild><Link to={base === "/learner" ? "/learner/program-saya" : base === "/teacher" ? "/teacher/kelas" : base + "/program"}>Buka program</Link></Button></div> : <>
      <div className="agenda-timeline">{days.map((day) => <section key={day} className="agenda-day"><h2>{dateLabel(day)}{day === today && <span>Hari ini</span>}</h2><div>{paged.filter((e) => e.day === day).map((e) => {
        const done = base === "/learner" && (e.completed || e.waiting);
        const overdue = e.kind === "due" && !done && Date.parse(e.at) < Date.now();
        return <article className={`agenda-event agenda-event-${e.kind}`} key={e.key}>
          <div className="agenda-time"><time dateTime={e.at}>{new Date(e.at).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" })}</time><span>WIB</span></div>
          <div className="agenda-event-body"><div className="agenda-tags"><span>{e.kind === "release" ? "Rilis materi" : "Batas waktu"}</span>{done ? <span>{e.completed ? "Selesai" : "Menunggu nilai"}</span> : overdue && <span>{base === "/learner" ? "Terlewat" : "Lewat tenggat"}</span>}{e.locked && <span>Prasyarat belum selesai</span>}</div><h3>{e.title}</h3><p>{e.program_name}</p></div>
          <Button asChild variant="outline" size="sm"><Link to={agendaTarget(base, e)} aria-label={`${e.locked ? "Buka prasyarat" : "Buka materi"}: ${e.title}`}>{e.locked ? "Prasyarat" : "Buka materi"}<ArrowUpRight size={15}/></Link></Button>
        </article>;
      })}</div></section>)}</div>
      <nav className="agenda-pagination" aria-label="Halaman agenda"><Button variant="outline" disabled={page === 1} onClick={() => update("page", String(page - 1))}>Sebelumnya</Button><span>{page} / {Math.max(1, Math.ceil(visible.length / 30))} · {visible.length} kegiatan</span><Button variant="outline" disabled={page * 30 >= visible.length} onClick={() => update("page", String(page + 1))}>Berikutnya</Button></nav>
    </>}
    <nav className="agenda-related" aria-label="Menu terkait agenda"><Link to={base === "/learner" ? "/learner/progres" : base === "/teacher" ? "/teacher/progres" : base + "/peserta"}>{base === "/learner" ? "Progres saya" : "Progres peserta"} →</Link><Link to={base === "/learner" ? "/learner/pengumuman" : base === "/teacher" ? "/teacher/review" : base + "/penilaian"}>{base === "/learner" ? "Pengumuman" : "Penilaian"} →</Link></nav>
  </div>;
}
