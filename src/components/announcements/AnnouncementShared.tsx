import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Pin } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import {
  announcementAction,
  announcementDate,
  announcementError,
  announcementRoles,
  announcementState,
  announcementStates,
  type Announcement,
} from "../../lib/announcementWorkspace";
import type { RoleCode } from "../../lib/auth";
export function AnnouncementBadge({ item }: { item: Announcement }) {
  const state = announcementState(item),
    meta = announcementStates[state];
  return (
    <span className={`admission-badge announcement-tone-${meta.tone}`}>
      {meta.label}
    </span>
  );
}
export function AnnouncementPagination({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="certificate-pagination">
      <Button
        variant="outline"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Sebelumnya
      </Button>
      <span>
        {page} / {pages}
      </span>
      <Button
        variant="outline"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        Berikutnya
      </Button>
    </div>
  );
}
export function AnnouncementConfirm({
  title,
  children,
  onClose,
  onConfirm,
  label,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  onConfirm: () => Promise<unknown>;
  label: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Dialog title={title} onClose={onClose} busy={busy}>
      {children}
      {error && (
        <p className="program-error mt-4" role="alert">
          {error}
        </p>
      )}
      <footer className="workspace-dialog__footer">
        <Button variant="outline" disabled={busy} onClick={onClose}>
          Periksa lagi
        </Button>
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await onConfirm();
              onClose();
            } catch (e) {
              setError(announcementError(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Menyimpan…" : label}
        </Button>
      </footer>
    </Dialog>
  );
}
export function AnnouncementMessage({
  item,
  role,
  preview = false,
}: {
  item: Announcement;
  role: RoleCode | null;
  preview?: boolean;
}) {
  const action = announcementAction(item, role);
  return (
    <article className="announcement-message">
      <div className="announcement-message-meta">
        {item.is_pinned && (
          <span>
            <Pin size={14} />
            Disematkan
          </span>
        )}
        <time>{announcementDate(item.publish_at ?? item.created_at)}</time>
      </div>
      <h2>{item.title}</h2>
      <div className="announcement-audience-tags">
        <span>{item.program_name ?? "Semua program"}</span>
        {item.class_name && <span>{item.class_name}</span>}
        <span>{announcementRoles[item.target_role] ?? item.target_role}</span>
      </div>
      <p className="announcement-body">{item.content}</p>
      {action &&
        (preview ? (
          <span className="announcement-action-preview">
            {action.label}
            <ArrowUpRight size={15} />
          </span>
        ) : (
          <Button asChild variant="outline">
            <Link to={action.to}>
              {action.label}
              <ArrowUpRight size={15} />
            </Link>
          </Button>
        ))}
      {item.expires_at && (
        <p className="announcement-expiry">
          Berlaku sampai {announcementDate(item.expires_at)}
        </p>
      )}
    </article>
  );
}
