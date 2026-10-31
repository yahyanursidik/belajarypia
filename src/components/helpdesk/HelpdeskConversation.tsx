import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCheck,
  Clock3,
  LockKeyhole,
  MessageSquare,
  Send,
  Settings2,
  RefreshCw,
} from "lucide-react";
import { Button } from "../ui/button";
import { useAuthSession } from "../../app/providers/authSessionContext";
import {
  readHelpdeskPending,
  useHelpdeskCommand,
  useHelpdeskQuery,
} from "../../lib/helpdeskData";
import {
  helpdeskDate,
  helpdeskLinks,
  helpdeskStatuses,
  isHelpdeskDone,
  type HelpdeskDetail,
  type HelpdeskTicket,
} from "../../lib/helpdeskWorkspace";
import { HelpdeskBadge, HelpdeskError } from "./HelpdeskShared";
import { HelpdeskManageDialog } from "./HelpdeskManageDialog";
export function HelpdeskConversation({
  id,
  onBack,
  onChanged,
}: {
  id: string;
  onBack: () => void;
  onChanged: () => void;
}) {
  const query = useHelpdeskQuery<HelpdeskDetail>("helpdesk_detail", {
    p_id: id,
  });
  const { primaryRole } = useAuthSession();
  const [manage, setManage] = useState(false);
  const [mode, setMode] = useState<"reply" | "note">("reply");
  async function changed() {
    await query.load();
    onChanged();
  }
  if (query.error)
    return (
      <section className="helpdesk-conversation">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft size={16} />
          Antrean tiket
        </Button>
        <HelpdeskError retry={() => void query.load()}>
          {query.error}
        </HelpdeskError>
      </section>
    );
  if (!query.data)
    return (
      <div className="helpdesk-empty" role="status">
        Memuat percakapan…
      </div>
    );
  const { ticket: t, messages, events } = query.data;
  const links = helpdeskLinks(t, primaryRole);
  return (
    <section
      className="helpdesk-conversation"
      aria-label={`Percakapan ${t.ticket_number}`}
      aria-busy={query.loading}
    >
      <header className="helpdesk-conversation-head">
        <div className="helpdesk-row">
          <Button size="sm" variant="ghost" onClick={onBack}>
            <ArrowLeft size={16} />
            Antrean
          </Button>
          <span className="helpdesk-caption">{t.ticket_number}</span>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Muat ulang percakapan"
            disabled={query.loading}
            onClick={() => void query.load()}
          >
            <RefreshCw size={16} />
          </Button>
        </div>
        <h2>{t.subject}</h2>
        <div className="helpdesk-row helpdesk-wrap">
          <HelpdeskBadge value={t.status} />
          <HelpdeskBadge value={t.priority} kind="priority" />
          <span className="helpdesk-caption">
            {t.reporter_name ?? "Pelapor"} · {helpdeskDate(t.created_at)} WIB
          </span>
        </div>
      </header>
      <div className="helpdesk-context-strip">
        <div>
          <strong>{t.program_name ?? "Bantuan umum"}</strong>
          <span>
            {t.assigned_name
              ? `Petugas: ${t.assigned_name}`
              : "Belum ditugaskan"}
          </span>
          {t.invoice_number && <span>{t.invoice_number}</span>}
        </div>
        <div className="helpdesk-row helpdesk-wrap">
          {links.map((l) => (
            <Button key={l.href} asChild size="sm" variant="outline">
              <Link to={l.href}>
                {l.label}
                <ArrowUpRight size={14} />
              </Link>
            </Button>
          ))}
          {t.can_manage && (
            <Button size="sm" variant="outline" onClick={() => setManage(true)}>
              <Settings2 size={15} />
              Kelola
            </Button>
          )}
        </div>
      </div>
      {t.follow_up_at && t.can_manage && (
        <p className="helpdesk-follow">
          <Clock3 size={14} />
          Tindak lanjut: {helpdeskDate(t.follow_up_at)} WIB
        </p>
      )}
      <div className="helpdesk-thread" aria-label="Pesan tiket">
        {!messages.length && (
          <p className="helpdesk-caption">
            Tiket lama ini belum memiliki pesan. Mulai percakapan di bawah.
          </p>
        )}
        {messages.map((m) => (
          <article
            key={m.id}
            className={`helpdesk-message ${m.is_internal_note ? "helpdesk-message-note" : m.sender_id === t.reporter_id ? "helpdesk-message-reporter" : "helpdesk-message-staff"}`}
          >
            <header>
              <strong>
                {m.sender_name ?? "Pengguna"}
                {m.sender_id === t.reporter_id ? " · Pelapor" : ""}
              </strong>
              {m.is_internal_note && (
                <span>
                  <LockKeyhole size={12} />
                  Internal
                </span>
              )}
              <time dateTime={m.created_at}>
                {helpdeskDate(m.created_at)} WIB
              </time>
            </header>
            <p>{m.message_body}</p>
          </article>
        ))}
        {isHelpdeskDone(t.status) && (
          <div className="helpdesk-resolution">
            <CheckCheck size={18} />
            <div>
              <strong>{helpdeskStatuses[t.status]}</strong>
              {t.resolution_summary && <p>{t.resolution_summary}</p>}
            </div>
          </div>
        )}
        <details className="helpdesk-history">
          <summary>Riwayat tiket ({events.length})</summary>
          {events.length ? (
            events.map((e) => (
              <p key={e.id}>
                <time>{helpdeskDate(e.created_at)}</time> ·{" "}
                {e.actor_name ?? "Pengguna"} ·{" "}
                {e.kind === "created"
                  ? "Tiket dibuat"
                  : e.kind === "status"
                    ? `${helpdeskStatuses[e.details.from as keyof typeof helpdeskStatuses] ?? e.details.from} → ${helpdeskStatuses[e.details.to as keyof typeof helpdeskStatuses] ?? e.details.to}`
                    : "Pengaturan tiket diperbarui"}
                {e.is_internal ? " · Internal" : ""}
              </p>
            ))
          ) : (
            <p>Belum ada riwayat pada tiket lama.</p>
          )}
        </details>
      </div>
      <div className="helpdesk-composer-wrap">
        {t.can_manage && (
          <div
            className="helpdesk-reply-switch"
            role="group"
            aria-label="Jenis pesan"
          >
            <Button
              size="sm"
              variant={mode === "reply" ? "secondary" : "ghost"}
              aria-pressed={mode === "reply"}
              onClick={() => setMode("reply")}
            >
              <MessageSquare size={14} />
              Balasan publik
            </Button>
            <Button
              size="sm"
              variant={mode === "note" ? "secondary" : "ghost"}
              aria-pressed={mode === "note"}
              onClick={() => setMode("note")}
            >
              <LockKeyhole size={14} />
              Catatan internal
            </Button>
          </div>
        )}
        <HelpdeskComposer
          key={`${id}:${mode}`}
          ticket={t}
          internal={mode === "note" && t.can_manage}
          onSent={() => void changed()}
        />
      </div>
      {manage && (
        <HelpdeskManageDialog
          key={t.id}
          ticket={t}
          onClose={() => setManage(false)}
          onSaved={() => {
            setManage(false);
            void changed();
          }}
        />
      )}
    </section>
  );
}
function HelpdeskComposer({
  ticket,
  internal,
  onSent,
}: {
  ticket: HelpdeskTicket;
  internal: boolean;
  onSent: () => void;
}) {
  const { user } = useAuthSession();
  const key = `ypia-helpdesk:${user?.id}:${ticket.id}:${internal ? "note" : "reply"}`;
  const command = useHelpdeskCommand(key);
  const [body, setBody] = useState(() => {
    try {
      return (
        (readHelpdeskPending(key)?.args.p_body as string) ||
        sessionStorage.getItem(`${key}:draft`) ||
        ""
      );
    } catch {
      return "";
    }
  });
  const [status, setStatus] = useState(
    () =>
      (readHelpdeskPending(key)?.args.p_status as string) || "waiting_reporter",
  );
  const [reopen, setReopen] = useState(!!readHelpdeskPending(key));
  const [cacheError, setCacheError] = useState("");
  useEffect(() => {
    try {
      if (body) sessionStorage.setItem(`${key}:draft`, body);
      else sessionStorage.removeItem(`${key}:draft`);
    } catch {
      setCacheError("Draf hanya tersimpan selama halaman ini terbuka.");
    }
  }, [body, key]);
  const needsReopen = !ticket.can_manage && isHelpdeskDone(ticket.status);
  const locked = command.busy || command.uncertain;
  async function send() {
    if (!body.trim() || (needsReopen && !reopen)) return;
    const result = await command.run<{ id: string }>("helpdesk_reply", {
      p_id: ticket.id,
      p_body: body,
      p_internal: internal,
      p_status: internal
        ? null
        : ticket.can_manage
          ? status
          : needsReopen
            ? "open"
            : null,
      p_expected_updated_at: ticket.updated_at,
    });
    if (result) {
      setBody("");
      setReopen(false);
      onSent();
    }
  }
  return (
    <div
      className={`helpdesk-composer ${internal ? "helpdesk-composer-internal" : ""}`}
    >
      <label htmlFor={`message-${ticket.id}`}>
        {internal
          ? "Catatan untuk petugas"
          : "Pesan untuk " + (ticket.can_manage ? "pelapor" : "tim bantuan")}
      </label>
      <textarea
        id={`message-${ticket.id}`}
        className="field-control"
        rows={4}
        value={body}
        maxLength={8000}
        disabled={locked}
        placeholder={
          internal
            ? "Hanya petugas berwenang yang dapat membaca."
            : "Tulis pesan…"
        }
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            if (!command.busy) void send();
          }
        }}
      />
      {needsReopen && (
        <label className="helpdesk-check">
          <input
            type="checkbox"
            checked={reopen}
            disabled={locked}
            onChange={(e) => setReopen(e.target.checked)}
          />
          Buka kembali tiket dengan balasan ini
        </label>
      )}
      <div className="helpdesk-composer-footer">
        <small>
          {body.length}/8.000{internal ? " · Internal" : " · Publik"}
        </small>
        {ticket.can_manage && !internal && (
          <label>
            Setelah membalas
            <select
              className="field-control"
              disabled={locked}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="waiting_reporter">Menunggu pelapor</option>
              <option value="in_progress">Tetap diproses</option>
              <option value="resolved">Selesai</option>
            </select>
          </label>
        )}
        <Button
          disabled={command.busy || !body.trim() || (needsReopen && !reopen)}
          onClick={() => void send()}
        >
          <Send size={15} />
          {command.busy
            ? "Mengirim…"
            : command.uncertain
              ? "Periksa kiriman"
              : internal
                ? "Simpan catatan"
                : needsReopen
                  ? "Balas & buka kembali"
                  : "Kirim balasan"}
        </Button>
      </div>
      {command.uncertain && (
        <p role="status" className="helpdesk-notice">
          Kiriman belum terkonfirmasi. Coba lagi untuk memeriksa pesan yang
          sama.
        </p>
      )}
      {cacheError && (
        <p role="status" className="helpdesk-caption">
          {cacheError}
        </p>
      )}
      {command.error && <HelpdeskError>{command.error}</HelpdeskError>}
    </div>
  );
}
