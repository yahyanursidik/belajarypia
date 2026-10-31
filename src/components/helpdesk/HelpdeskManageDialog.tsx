import { useState } from "react";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { useAuthSession } from "../../app/providers/authSessionContext";
import {
  readHelpdeskPending,
  useHelpdeskCommand,
  useHelpdeskQuery,
} from "../../lib/helpdeskData";
import {
  emptyHelpdeskOptions,
  helpdeskStatuses,
  helpdeskPriorities,
  type HelpdeskTicket,
  type HelpdeskOptions,
  type HelpdeskPayload,
} from "../../lib/helpdeskWorkspace";
import { HelpdeskError, HelpdeskContextFields } from "./HelpdeskShared";
type Patch = Pick<
  HelpdeskTicket,
  | "status"
  | "priority"
  | "assigned_to"
  | "follow_up_at"
  | "resolution_summary"
  | "target_program_id"
  | "enrollment_id"
  | "invoice_id"
>;
export function HelpdeskManageDialog({
  ticket,
  onClose,
  onSaved,
}: {
  ticket: HelpdeskTicket;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuthSession();
  const key = `ypia-helpdesk:${user?.id}:${ticket.id}:manage`;
  const command = useHelpdeskCommand(key);
  const [draft, setDraft] = useState<Patch>(
    () =>
      (readHelpdeskPending(key)?.args.p_patch as Patch | null) ?? {
        status: ticket.status,
        priority: ticket.priority,
        assigned_to: ticket.assigned_to,
        follow_up_at: ticket.follow_up_at,
        resolution_summary: ticket.resolution_summary,
        target_program_id: ticket.target_program_id,
        enrollment_id: ticket.enrollment_id,
        invoice_id: ticket.invoice_id,
      },
  );
  const [version] = useState(ticket.updated_at);
  const options = useHelpdeskQuery<HelpdeskOptions>("helpdesk_options", {
    p_ticket: ticket.id,
  });
  const data = options.data ?? emptyHelpdeskOptions;
  const locked = command.busy || command.uncertain;
  function patch(v: Partial<Patch>) {
    setDraft((d) => ({ ...d, ...v }));
  }
  async function save() {
    const result = await command.run<{ id: string }>("helpdesk_manage", {
      p_id: ticket.id,
      p_patch: draft,
      p_expected_updated_at: version,
    });
    if (result) onSaved();
  }
  const follow = draft.follow_up_at
    ? new Date(new Date(draft.follow_up_at).getTime() + 7 * 3600000)
        .toISOString()
        .slice(0, 16)
    : "";
  return (
    <Dialog
      title={`Kelola ${ticket.ticket_number}`}
      onClose={onClose}
      busy={command.busy}
      className="helpdesk-dialog"
    >
      <p className="helpdesk-caption">
        Status dan ringkasan dapat dibaca pelapor.
      </p>
      {command.uncertain && (
        <p className="helpdesk-notice">
          Perubahan belum terkonfirmasi. Periksa kiriman yang sama.
        </p>
      )}
      {options.error && (
        <HelpdeskError retry={() => void options.load()}>
          {options.error}
        </HelpdeskError>
      )}
      <fieldset
        disabled={locked || options.loading || !!options.error}
        className="helpdesk-form-stack"
      >
        <div className="helpdesk-form-grid">
          <label>
            Status
            <select
              className="field-control"
              value={draft.status}
              onChange={(e) =>
                patch({ status: e.target.value as Patch["status"] })
              }
            >
              {Object.entries(helpdeskStatuses).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            Prioritas
            <select
              className="field-control"
              value={draft.priority}
              onChange={(e) =>
                patch({ priority: e.target.value as Patch["priority"] })
              }
            >
              {Object.entries(helpdeskPriorities).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            Petugas
            <select
              className="field-control"
              value={draft.assigned_to ?? ""}
              onChange={(e) => patch({ assigned_to: e.target.value || null })}
            >
              <option value="">Belum ditugaskan</option>
              {data.assignees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.id === user?.id ? " (Saya)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tindak lanjut (WIB)
            <input
              className="field-control"
              type="datetime-local"
              value={follow}
              onChange={(e) =>
                patch({
                  follow_up_at: e.target.value
                    ? new Date(`${e.target.value}:00+07:00`).toISOString()
                    : null,
                })
              }
            />
          </label>
        </div>
        <HelpdeskContextFields
          value={{ ...draft, category: ticket.category }}
          options={data}
          onChange={(v: Partial<HelpdeskPayload>) =>
            patch({ ...v, assigned_to: null })
          }
        />
        <label>
          Ringkasan penyelesaian
          {["resolved", "closed"].includes(draft.status) ? " *" : ""}
          <textarea
            className="field-control"
            maxLength={8000}
            rows={3}
            value={draft.resolution_summary ?? ""}
            onChange={(e) =>
              patch({ resolution_summary: e.target.value || null })
            }
          />
        </label>
        {draft.assigned_to !== ticket.assigned_to && (
          <p className="helpdesk-notice">
            Tiket dapat berpindah dari antrean Anda setelah penugasan.
          </p>
        )}
      </fieldset>
      {command.error && <HelpdeskError>{command.error}</HelpdeskError>}
      <footer className="workspace-dialog__footer">
        <Button variant="outline" disabled={command.busy} onClick={onClose}>
          Batal
        </Button>
        <Button
          disabled={
            command.busy ||
            options.loading ||
            !!options.error ||
            (["resolved", "closed"].includes(draft.status) &&
              !draft.resolution_summary?.trim())
          }
          onClick={() => void save()}
        >
          {command.busy
            ? "Menyimpan…"
            : command.uncertain
              ? "Periksa kiriman"
              : "Simpan perubahan"}
        </Button>
      </footer>
    </Dialog>
  );
}
