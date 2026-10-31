import type { ReactNode } from "react";
import { Dialog } from "../ui/dialog";

export function ProgramDialog({
  title,
  children,
  onClose,
  busy,
  error,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy: boolean;
  error?: string | null;
  wide?: boolean;
}) {
  return (
    <Dialog
      title={title}
      onClose={onClose}
      busy={busy}
      className={
        wide ? "program-dialog program-dialog--wide" : "program-dialog"
      }
    >
      {error && (
        <p className="program-error" role="alert">
          {error}
        </p>
      )}
      <fieldset disabled={busy} className="program-dialog-content">
        {children}
      </fieldset>
    </Dialog>
  );
}
