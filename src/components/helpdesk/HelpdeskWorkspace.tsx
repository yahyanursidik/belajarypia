import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  BookOpen,
  CheckCheck,
  CircleHelp,
  Clock3,
  Inbox,
  Mail,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  UserRound,
  Wallet,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { useSystemSettings } from "../../lib/useSystemSettings";
import { settingsContacts } from "../../lib/settingsWorkspace";
import { useHelpdeskQuery } from "../../lib/helpdeskData";
import {
  helpdeskCategories,
  helpdeskDate,
  helpdeskPage,
  helpdeskPriorities,
  helpdeskStatuses,
  type HelpdeskList,
  type HelpdeskPayload,
} from "../../lib/helpdeskWorkspace";
import { HelpdeskBadge, HelpdeskError } from "./HelpdeskShared";
import { HelpdeskConversation } from "./HelpdeskConversation";
import { HelpdeskCreateWizard } from "./HelpdeskCreateWizard";
export function HelpdeskWorkspace({ staff = false }: { staff?: boolean }) {
  const { user } = useAuthSession();
  const [params, setParams] = useSearchParams();
  const [create, setCreate] = useState(false);
  const [notice, setNotice] = useState("");
  const selected = params.get("ticket") ?? "";
  const page = helpdeskPage(params.get("page"));
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filters = Object.fromEntries(
    [
      "q",
      "status",
      "category",
      "priority",
      "program",
      "assignment",
      "queue",
    ].map((k) => [k, params.get(k) || "all"]),
  );
  if (filters.q === "all") filters.q = "";
  const query = useHelpdeskQuery<HelpdeskList>("helpdesk_list", {
    p_view: staff ? "staff" : "mine",
    p_filters: filters,
    p_offset: (page - 1) * 20,
    p_limit: 20,
  });
  function update(values: Record<string, string | null>) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [k, v] of Object.entries(values)) {
          if (v && v !== "all") next.set(k, v);
          else next.delete(k);
        }
        if (!("page" in values) && !("ticket" in values)) next.delete("page");
        return next;
      },
      { replace: true },
    );
  }
  const q = params.get("q") ?? "";
  useEffect(() => {
    setSearch(q);
  }, [q]);
  useEffect(() => {
    if (search === q) return;
    const timer = setTimeout(
      () =>
        setParams(
          (current) => {
            const next = new URLSearchParams(current);
            if (search.trim()) next.set("q", search.trim());
            else next.delete("q");
            next.delete("page");
            return next;
          },
          { replace: true },
        ),
      350,
    );
    return () => clearTimeout(timer);
  }, [search, q, setParams]);
  useEffect(() => {
    if (query.data && page > Math.max(1, Math.ceil(query.data.total / 20)))
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete("page");
          return next;
        },
        { replace: true },
      );
  }, [query.data, page, setParams]);
  const initial: Partial<HelpdeskPayload> = {};
  if (params.get("category") && params.get("category")! in helpdeskCategories)
    initial.category = params.get("category") as HelpdeskPayload["category"];
  if (params.get("contextProgram"))
    initial.target_program_id = params.get("contextProgram");
  if (params.get("contextEnrollment"))
    initial.enrollment_id = params.get("contextEnrollment");
  if (params.get("contextInvoice"))
    initial.invoice_id = params.get("contextInvoice");
  const stats = query.data?.stats;
  return (
    <div
      className={`page-stack helpdesk-workspace ${selected ? "helpdesk-detail-open" : ""}`}
    >
      <header className="helpdesk-page-header">
        <div>
          <div className="helpdesk-eyebrow">
            <CircleHelp size={16} />
            {staff ? "LAYANAN LMS" : "PUSAT BANTUAN"}
          </div>
          <h1>{staff ? "Helpdesk" : "Ada yang bisa kami bantu?"}</h1>
          <p>
            {staff
              ? "Antrean, percakapan, dan tindak lanjut dalam satu tempat."
              : "Temukan panduan atau hubungi tim bantuan."}
          </p>
        </div>
        <div className="helpdesk-row">
          <Button
            variant="outline"
            onClick={() => void query.load()}
            disabled={query.loading}
            aria-label="Muat ulang tiket"
          >
            <RefreshCw size={16} />
            <span className="helpdesk-refresh-label">Muat ulang</span>
          </Button>
          <Button onClick={() => setCreate(true)}>
            <Plus size={17} />
            Buat tiket
          </Button>
        </div>
      </header>
      {!staff && <HelpdeskGuidance />}
      <div
        className={`helpdesk-metrics ${!staff ? "helpdesk-metrics-personal" : ""}`}
        aria-label={
          staff ? "Ringkasan tiket dalam cakupan Anda" : "Ringkasan tiket saya"
        }
      >
        {[
          { key: "active", label: "Tiket aktif", icon: Inbox, tone: "blue" },
          {
            key: "unassigned",
            label: "Belum ditugaskan",
            icon: UserRound,
            tone: "violet",
          },
          {
            key: "waiting",
            label: staff ? "Menunggu pelapor" : "Perlu balasan Anda",
            icon: Clock3,
            tone: "amber",
          },
          {
            key: "resolved",
            label: "Selesai & ditutup",
            icon: CheckCheck,
            tone: "green",
          },
        ]
          .filter((m) => staff || m.key !== "unassigned")
          .map((m) => (
            <div
              key={m.key}
              className={`helpdesk-metric helpdesk-metric-${m.tone}`}
            >
              <m.icon size={21} />
              <div>
                <strong>{stats?.[m.key as keyof typeof stats] ?? "—"}</strong>
                <span>{m.label}</span>
              </div>
            </div>
          ))}
      </div>
      {notice && (
        <div role="status" className="helpdesk-notice">
          {notice}
        </div>
      )}
      <section
        className={`helpdesk-inbox ${selected ? "helpdesk-has-selection" : ""}`}
      >
        <div className="helpdesk-list-panel">
          <div className="helpdesk-list-heading">
            <h2>{staff ? "Antrean tiket" : "Tiket saya"}</h2>
            <span>{query.data?.total ?? "—"} tiket</span>
          </div>
          <div className="helpdesk-search">
            <Search size={17} />
            <Input
              aria-label="Cari nomor atau judul tiket"
              placeholder="Cari nomor atau judul…"
              value={search}
              maxLength={160}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button
              size="icon"
              variant="outline"
              aria-label="Tampilkan filter tiket"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((v) => !v)}
            >
              <SlidersHorizontal size={16} />
            </Button>
          </div>
          <div
            className="helpdesk-quick-filters"
            role="group"
            aria-label="Antrean cepat"
          >
            <button
              aria-pressed={!params.get("queue") && !params.get("assignment")}
              onClick={() =>
                update({ queue: null, assignment: null, status: null })
              }
            >
              Semua
            </button>
            {staff && (
              <button
                aria-pressed={params.get("queue") === "reply"}
                onClick={() =>
                  update({ queue: "reply", assignment: null, status: null })
                }
              >
                Perlu balasan
              </button>
            )}
            {staff && (
              <button
                aria-pressed={params.get("assignment") === "mine"}
                onClick={() =>
                  update({ assignment: "mine", queue: null, status: null })
                }
              >
                Milik saya
              </button>
            )}
            {staff && (
              <button
                aria-pressed={params.get("queue") === "overdue"}
                onClick={() =>
                  update({ queue: "overdue", assignment: null, status: null })
                }
              >
                Lewat jadwal
              </button>
            )}
          </div>
          {filtersOpen && (
            <div className="helpdesk-filter-grid">
              {(
                [
                  ["status", "Status", helpdeskStatuses],
                  ["category", "Kategori", helpdeskCategories],
                  ["priority", "Prioritas", helpdeskPriorities],
                ] as const
              ).map(([key, label, values]) => (
                <label key={key}>
                  {label}
                  <select
                    className="field-control"
                    value={params.get(key) ?? "all"}
                    onChange={(e) => update({ [key]: e.target.value })}
                  >
                    <option value="all">Semua {label.toLowerCase()}</option>
                    {Object.entries(values).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <label>
                Program
                <select
                  className="field-control"
                  value={params.get("program") ?? "all"}
                  onChange={(e) => update({ program: e.target.value })}
                >
                  <option value="all">Semua program</option>
                  {query.data?.programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              {staff && (
                <label>
                  Penugasan
                  <select
                    className="field-control"
                    value={params.get("assignment") ?? "all"}
                    onChange={(e) => update({ assignment: e.target.value })}
                  >
                    <option value="all">Semua petugas</option>
                    <option value="mine">Milik saya</option>
                    <option value="unassigned">Belum ditugaskan</option>
                  </select>
                </label>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSearch("");
                  update({
                    q: null,
                    status: null,
                    category: null,
                    priority: null,
                    program: null,
                    assignment: null,
                    queue: null,
                  });
                }}
              >
                Reset filter
              </Button>
            </div>
          )}
          <div className="helpdesk-results" aria-busy={query.loading}>
            {query.error ? (
              <HelpdeskError retry={() => void query.load()}>
                {query.error}
              </HelpdeskError>
            ) : !query.data ? (
              <p className="helpdesk-empty" role="status">
                Memuat tiket…
              </p>
            ) : !query.data.items.length ? (
              <div className="helpdesk-empty">
                <Inbox size={34} />
                <h3>Tidak ada tiket</h3>
                <p>
                  {Object.values(filters).some((v) => v && v !== "all")
                    ? "Ubah filter untuk melihat tiket lainnya."
                    : "Tiket yang masuk akan tampil di sini."}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCreate(true)}
                >
                  Buat tiket
                </Button>
              </div>
            ) : (
              query.data.items.map((t) => (
                <button
                  key={t.id}
                  className={`helpdesk-ticket-card ${selected === t.id ? "helpdesk-ticket-selected" : ""}`}
                  aria-current={selected === t.id ? "true" : undefined}
                  onClick={() => update({ ticket: t.id })}
                >
                  <div className="helpdesk-row helpdesk-spread">
                    <span>{t.ticket_number}</span>
                    <HelpdeskBadge value={t.status} />
                  </div>
                  <h3>{t.subject}</h3>
                  <p>
                    {t.reporter_name ?? "Pelapor"} · {t.program_name ?? "Umum"}
                  </p>
                  <div className="helpdesk-row helpdesk-spread">
                    <HelpdeskBadge value={t.category} kind="category" />
                    {["high", "urgent"].includes(t.priority) && (
                      <HelpdeskBadge value={t.priority} kind="priority" />
                    )}
                  </div>
                  <div className="helpdesk-ticket-foot">
                    <span>
                      {t.assigned_to === user?.id
                        ? "Ditugaskan ke saya"
                        : (t.assigned_name ?? "Belum ditugaskan")}
                    </span>
                    {t.last_sender_id === t.reporter_id &&
                      !["resolved", "closed"].includes(t.status) && (
                        <span className="helpdesk-needs-reply">
                          {staff ? "Perlu balasan" : "Menunggu petugas"}
                        </span>
                      )}
                    {!staff &&
                      t.status === "waiting_reporter" &&
                      t.last_sender_id !== t.reporter_id && (
                        <span className="helpdesk-needs-reply">
                          Perlu balasan Anda
                        </span>
                      )}
                    <time>{helpdeskDate(t.updated_at)}</time>
                  </div>
                </button>
              ))
            )}
          </div>
          {query.data && query.data.total > 20 && (
            <nav className="helpdesk-pagination" aria-label="Halaman tiket">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1 || query.loading}
                onClick={() => update({ page: String(page - 1) })}
              >
                Sebelumnya
              </Button>
              <span>
                {page} / {Math.max(1, Math.ceil(query.data.total / 20))}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page * 20 >= query.data.total || query.loading}
                onClick={() => update({ page: String(page + 1) })}
              >
                Berikutnya
              </Button>
            </nav>
          )}
        </div>
        {selected ? (
          <HelpdeskConversation
            key={selected}
            id={selected}
            onBack={() => update({ ticket: null })}
            onChanged={() => void query.load()}
          />
        ) : (
          <div className="helpdesk-select-empty">
            <div className="helpdesk-select-icon">
              <MessageSquare size={32} />
            </div>
            <h2>Pilih tiket untuk memulai</h2>
            <p>Percakapan, konteks, dan tindak lanjut tampil di sini.</p>
            <div className="helpdesk-row helpdesk-wrap">
              <span>
                <MessageSquare size={15} />
                Balasan publik
              </span>
              {staff && (
                <span>
                  <Clock3 size={15} />
                  Tindak lanjut terjadwal
                </span>
              )}
            </div>
          </div>
        )}
      </section>
      {staff && (
        <p className="helpdesk-caption">
          Tiket sesuai cakupan akses Anda · Waktu WIB.
        </p>
      )}
      {create && (
        <HelpdeskCreateWizard
          initial={initial}
          onClose={() => setCreate(false)}
          onCreated={(id) => {
            setCreate(false);
            setNotice("Tiket berhasil dibuat.");
            update({ ticket: id });
            void query.load();
          }}
        />
      )}
    </div>
  );
}
function HelpdeskGuidance() {
  const { settings } = useSystemSettings();
  const { primaryRole } = useAuthSession();
  const contacts = settingsContacts(settings);
  const learner = primaryRole === "participant" || primaryRole === "guardian";
  return (
    <details className="helpdesk-guidance">
      <summary>
        <BookOpen size={18} />
        Panduan cepat & kontak
      </summary>
      <div className="helpdesk-guidance-grid">
        <div>
          <h3>Pembelajaran</h3>
          <p>
            Pilih program lalu buka materi atau ujian. Periksa jadwal,
            prasyarat, dan sisa percobaan jika ujian terkunci.
          </p>
          {learner && (
            <Link to="/learner/program-saya">Buka program saya →</Link>
          )}
        </div>
        <div>
          <h3>Pembayaran & donasi</h3>
          <p>
            Lihat rekening atau QR, laporkan transfer, lalu pantau verifikasinya
            di Pembayaran.
          </p>
          {learner && (
            <Link to="/learner/keuangan">
              <Wallet size={14} />
              Buka pembayaran →
            </Link>
          )}
        </div>
        <div>
          <h3>Nilai & sertifikat</h3>
          <p>
            Periksa progres dan hasil ujian pada program. Sertifikat tersedia
            setelah kelulusan ditetapkan dan penerbitan selesai.
          </p>
        </div>
        <div>
          <h3>Kontak bantuan</h3>
          {contacts.email && (
            <a href={contacts.email}>
              <Mail size={15} />
              Email bantuan
            </a>
          )}
          {contacts.whatsapp && (
            <a href={contacts.whatsapp} target="_blank" rel="noreferrer">
              WhatsApp bantuan ↗
            </a>
          )}
          {!contacts.email && !contacts.whatsapp && (
            <p>Gunakan tiket bantuan di halaman ini.</p>
          )}
        </div>
      </div>
    </details>
  );
}
