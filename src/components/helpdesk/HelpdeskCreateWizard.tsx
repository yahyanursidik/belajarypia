import { useState } from "react";
import { ArrowLeft, ArrowRight, Send } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Dialog } from "../ui/dialog";
import { WizardSteps } from "../ui/wizard-steps";
import { useAuthSession } from "../../app/providers/authSessionContext";
import {
  readHelpdeskPending,
  useHelpdeskCommand,
  useHelpdeskQuery,
} from "../../lib/helpdeskData";
import {
  emptyHelpdeskOptions,
  helpdeskCategories,
  validateHelpdesk,
  type HelpdeskOptions,
  type HelpdeskPayload,
} from "../../lib/helpdeskWorkspace";
import { HelpdeskContextFields, HelpdeskError } from "./HelpdeskShared";
export function HelpdeskCreateWizard({
  initial,
  onClose,
  onCreated,
}: {
  initial: Partial<HelpdeskPayload>;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { user } = useAuthSession();
  const commandKey = `ypia-helpdesk:${user?.id}:create`;
  const command = useHelpdeskCommand(commandKey);
  const [draft, setDraft] = useState<HelpdeskPayload>(
    () =>
      (readHelpdeskPending(commandKey)?.args
        .p_payload as HelpdeskPayload | null) ?? {
        subject: "",
        category: "other",
        message: "",
        target_program_id: null,
        enrollment_id: null,
        invoice_id: null,
        ...initial,
      },
  );
  const [step, setStep] = useState(command.uncertain ? 2 : 0);
  const [error, setError] = useState("");
  const options = useHelpdeskQuery<HelpdeskOptions>("helpdesk_options", {});
  const choices = options.data ?? emptyHelpdeskOptions;
  function patch(v: Partial<HelpdeskPayload>) {
    setDraft((d) => ({ ...d, ...v }));
    setError("");
  }
  function next() {
    if (step === 0) {
      const e = validateHelpdesk(draft);
      if (e) {
        setError(e);
        return;
      }
    }
    setStep((s) => s + 1);
  }
  async function submit() {
    const e = validateHelpdesk(draft);
    if (e) {
      setError(e);
      return;
    }
    const result = await command.run<{ id: string }>("helpdesk_create", {
      p_payload: draft,
    });
    if (result) onCreated(result.id);
  }
  const locked = command.busy || command.uncertain;
  return (
    <Dialog
      title="Buat tiket bantuan"
      onClose={onClose}
      busy={command.busy}
      className="helpdesk-dialog"
    >
      <WizardSteps steps={["Masalah", "Konteks", "Tinjau"]} current={step} />
      {command.uncertain && (
        <p className="helpdesk-notice" role="status">
          Kiriman belum terkonfirmasi. Coba lagi untuk memeriksa tiket yang
          sama.
        </p>
      )}
      {options.error && (
        <HelpdeskError retry={() => void options.load()}>
          {options.error}
        </HelpdeskError>
      )}
      <div className="helpdesk-form-stack">
        {step === 0 && (
          <>
            <label>
              Kategori
              <select
                className="field-control"
                disabled={locked}
                value={draft.category}
                onChange={(e) =>
                  patch({
                    category: e.target.value as HelpdeskPayload["category"],
                    invoice_id: null,
                  })
                }
              >
                {Object.entries(helpdeskCategories).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Judul
              <Input
                autoFocus
                maxLength={160}
                placeholder="Contoh: Materi pertemuan 3 belum terbuka"
                value={draft.subject}
                disabled={locked}
                onChange={(e) => patch({ subject: e.target.value })}
              />
            </label>
            <label>
              Pesan
              <textarea
                className="field-control"
                rows={6}
                maxLength={8000}
                placeholder="Ceritakan kendala dan langkah yang sudah dicoba."
                value={draft.message}
                disabled={locked}
                onChange={(e) => patch({ message: e.target.value })}
              />
              <small>
                {draft.message.length}/8.000 · Jangan tulis kata sandi atau kode
                OTP.
              </small>
            </label>
          </>
        )}
        {step === 1 && (
          <>
            <HelpdeskContextFields
              value={draft}
              onChange={patch}
              options={choices}
              disabled={locked || options.loading}
            />
            <p className="helpdesk-caption">
              Pilih konteks agar bantuan sampai ke petugas yang tepat.
            </p>
            {draft.category === "billing" && (
              <p className="helpdesk-notice">
                Bukti transfer tetap di menu Pembayaran. Cukup pilih tagihannya
                di sini.
              </p>
            )}
          </>
        )}
        {step === 2 && (
          <section className="helpdesk-review">
            <HelpdeskBadgeSummary draft={draft} options={choices} />
            <h3>{draft.subject}</h3>
            <p>{draft.message}</p>
          </section>
        )}
      </div>
      {(error || command.error) && (
        <HelpdeskError>{error || command.error}</HelpdeskError>
      )}
      <footer className="workspace-dialog__footer">
        <Button
          variant="outline"
          disabled={step === 0 || locked}
          onClick={() => setStep((s) => s - 1)}
        >
          <ArrowLeft size={16} />
          Kembali
        </Button>
        {step < 2 ? (
          <Button
            disabled={locked || options.loading || !!options.error}
            onClick={next}
          >
            Lanjut
            <ArrowRight size={16} />
          </Button>
        ) : (
          <Button
            disabled={command.busy || !!options.error}
            onClick={() => void submit()}
          >
            <Send size={16} />
            {command.busy
              ? "Mengirim…"
              : command.uncertain
                ? "Periksa kiriman"
                : "Kirim tiket"}
          </Button>
        )}
      </footer>
    </Dialog>
  );
}
function HelpdeskBadgeSummary({
  draft,
  options,
}: {
  draft: HelpdeskPayload;
  options: HelpdeskOptions;
}) {
  return (
    <div className="helpdesk-caption">
      {helpdeskCategories[draft.category]} ·{" "}
      {options.programs.find((p) => p.id === draft.target_program_id)?.name ??
        "Umum"}
      {draft.invoice_id &&
        ` · ${options.invoices.find((i) => i.id === draft.invoice_id)?.number ?? "Tagihan dipilih"}`}
    </div>
  );
}
