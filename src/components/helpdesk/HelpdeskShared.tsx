import type { ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "../ui/button";
import {
  helpdeskStatuses,
  helpdeskCategories,
  helpdeskPriorities,
  type HelpdeskOptions,
  type HelpdeskPayload,
} from "../../lib/helpdeskWorkspace";
export function HelpdeskBadge({
  value,
  kind = "status",
}: {
  value: string;
  kind?: "status" | "priority" | "category";
}) {
  const labels =
    kind === "status"
      ? helpdeskStatuses
      : kind === "priority"
        ? helpdeskPriorities
        : helpdeskCategories;
  return (
    <span className={`helpdesk-badge helpdesk-${value}`}>
      {(labels as Record<string, string>)[value] ?? value}
    </span>
  );
}
export function HelpdeskError({
  children,
  retry,
}: {
  children: ReactNode;
  retry?: () => void;
}) {
  return (
    <div className="helpdesk-error" role="alert">
      <AlertCircle size={18} />
      <span>{children}</span>
      {retry && (
        <Button variant="outline" size="sm" onClick={retry}>
          <RefreshCw size={14} />
          Coba lagi
        </Button>
      )}
    </div>
  );
}
export function HelpdeskContextFields({
  value,
  onChange,
  options,
  disabled = false,
}: {
  value: Pick<
    HelpdeskPayload,
    "target_program_id" | "enrollment_id" | "invoice_id" | "category"
  >;
  onChange: (p: Partial<HelpdeskPayload>) => void;
  options: HelpdeskOptions;
  disabled?: boolean;
}) {
  return (
    <div className="helpdesk-form-grid">
      <label>
        Program
        <select
          className="field-control"
          value={value.target_program_id ?? ""}
          disabled={disabled}
          onChange={(e) =>
            onChange({
              target_program_id: e.target.value || null,
              enrollment_id: null,
              invoice_id: null,
            })
          }
        >
          <option value="">Umum / tidak terkait program</option>
          {options.programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {value.target_program_id && (
        <label>
          Peserta / pendaftaran
          <select
            className="field-control"
            disabled={disabled}
            value={value.enrollment_id ?? ""}
            onChange={(e) =>
              onChange({
                enrollment_id: e.target.value || null,
                invoice_id: null,
              })
            }
          >
            <option value="">Tidak terkait peserta tertentu</option>
            {options.enrollments
              .filter((e) => e.program_id === value.target_program_id)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {e.number}
                </option>
              ))}
          </select>
        </label>
      )}
      {value.category === "billing" && value.enrollment_id && (
        <label>
          Tagihan
          <select
            className="field-control"
            disabled={disabled}
            value={value.invoice_id ?? ""}
            onChange={(e) => onChange({ invoice_id: e.target.value || null })}
          >
            <option value="">Tanpa tagihan / donasi</option>
            {options.invoices
              .filter((i) => i.enrollment_id === value.enrollment_id)
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {i.number}
                </option>
              ))}
          </select>
        </label>
      )}
    </div>
  );
}
