import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ClipboardList,
  ReceiptText,
  Megaphone,
} from "lucide-react";
import { Dialog } from "../ui/dialog";
import { Button } from "../ui/button";
import { WizardSteps } from "../ui/wizard-steps";
import {
  dashboardIntentHref,
  type DashboardIntent,
  type DashboardProgram,
} from "../../lib/dashboardWorkspace";
const intents = [
  {
    key: "admission" as const,
    label: "Siapkan pendaftaran",
    hint: "Formulir & undangan",
    icon: ClipboardList,
  },
  {
    key: "invoice" as const,
    label: "Buat tagihan kelas",
    hint: "Peserta & periode tagihan",
    icon: ReceiptText,
  },
  {
    key: "announcement" as const,
    label: "Buat pengumuman",
    hint: "Penerima & jadwal",
    icon: Megaphone,
  },
];
export function DashboardStartDialog({
  programs,
  initialProgram,
  onClose,
}: {
  programs: DashboardProgram[];
  initialProgram: string | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [intent, setIntent] = useState<DashboardIntent>("admission");
  const [program, setProgram] = useState(initialProgram ?? "");
  const [step, setStep] = useState(0);
  const choices = programs.filter((p) =>
    intent === "invoice" ? p.status === "active" : p.status !== "archived",
  );
  const selected = choices.find((p) => p.id === program);
  return (
    <Dialog
      title="Mulai pekerjaan"
      onClose={onClose}
      className="dashboard-start-dialog"
    >
      <WizardSteps
        steps={["Pilih pekerjaan", "Pilih program"]}
        current={step}
      />
      {step === 0 ? (
        <div
          className="dashboard-intents"
          role="radiogroup"
          aria-label="Pekerjaan"
        >
          {intents.map((i) => (
            <label
              key={i.key}
              className={intent === i.key ? "dashboard-intent-selected" : ""}
            >
              <input
                type="radio"
                name="dashboard-intent"
                value={i.key}
                checked={intent === i.key}
                onChange={() => setIntent(i.key)}
              />
              <i.icon size={21} />
              <span>
                <strong>{i.label}</strong>
                <small>{i.hint}</small>
              </span>
            </label>
          ))}
        </div>
      ) : (
        <div className="dashboard-start-review">
          <label>
            Program
            <select
              className="field-control"
              value={selected?.id ?? ""}
              onChange={(e) => setProgram(e.target.value)}
            >
              <option value="">Pilih program</option>
              {choices.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.status === "draft" ? " · Draf" : ""}
                </option>
              ))}
            </select>
          </label>
          {!choices.length ? (
            <p className="dashboard-empty">
              Belum ada program yang sesuai. Buat atau aktifkan program terlebih
              dahulu.
            </p>
          ) : (
            <div className="dashboard-intent-preview">
              <strong>{intents.find((i) => i.key === intent)?.label}</strong>
              <span>{selected?.name ?? "Pilih program untuk melanjutkan"}</span>
              <small>
                {intent === "admission"
                  ? "Formulir pendaftaran"
                  : intent === "invoice"
                    ? "Wizard tagihan kelas"
                    : "Editor pengumuman"}
              </small>
            </div>
          )}
        </div>
      )}
      <footer className="workspace-dialog__footer">
        <Button
          variant="outline"
          disabled={step === 0}
          onClick={() => setStep(0)}
        >
          <ArrowLeft size={16} />
          Kembali
        </Button>
        {step === 0 ? (
          <Button onClick={() => setStep(1)}>
            Lanjut
            <ArrowRight size={16} />
          </Button>
        ) : (
          <Button
            disabled={!selected}
            onClick={() => {
              if (selected) {
                onClose();
                navigate(dashboardIntentHref(intent, selected.id));
              }
            }}
          >
            Buka{" "}
            {intent === "admission"
              ? "pendaftaran"
              : intent === "invoice"
                ? "wizard tagihan"
                : "editor"}
            <ArrowRight size={16} />
          </Button>
        )}
      </footer>
    </Dialog>
  );
}
