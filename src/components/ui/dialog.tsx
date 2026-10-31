import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./button";

const activeDialogs = new Set<HTMLDialogElement>();
let previousBodyOverflow = "";

export function Dialog({ title, children, onClose, busy = false, className = '' }: {
  title: string; children: ReactNode; onClose: () => void; busy?: boolean; className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    if(!activeDialogs.size)previousBodyOverflow=document.body.style.overflow;
    if(dialog)activeDialogs.add(dialog);
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      if(dialog)activeDialogs.delete(dialog);
      if(!activeDialogs.size)document.body.style.overflow=previousBodyOverflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return <dialog ref={ref} className={`workspace-dialog ${className}`} aria-labelledby={titleId} aria-busy={busy}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <header className="workspace-dialog__header"><h2 id={titleId}>{title}</h2>
      <Button type="button" variant="ghost" size="icon" onClick={onClose} disabled={busy} aria-label="Tutup dialog"><X className="h-4 w-4" /></Button>
    </header>
    <div className="workspace-dialog__body">{children}</div>
  </dialog>;
}
