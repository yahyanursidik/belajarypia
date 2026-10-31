import { useRef, useState } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { financeRpc, useFinanceRequestKey } from "../../lib/financeData";
import {
  financeDate,
  financeError,
  rupiah,
  validMoney,
  type FinanceData,
} from "../../lib/financeWorkspace";
import { FinancePagination, FinanceWizardFrame } from "./FinanceShared";
export function InvoiceCreateDialog({
  data,
  initialProgram,
  onClose,
  onSaved,
}: {
  data: FinanceData;
  initialProgram: string;
  onClose: () => void;
  onSaved: (ids: string[]) => void;
}) {
  const [program, setProgram] = useState(
    initialProgram === "all" ? "" : initialProgram,
  );
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    title: "Biaya kelas",
    invoice_type: "education_infaq",
    amount: "",
    billing_month: financeDate().slice(0, 7),
    due_date: "",
  });
  const initial = useRef(JSON.stringify(form));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestKey = useFinanceRequestKey();
  const participants = new Map(data.participants.map((p) => [p.id, p]));
  const eligible = data.enrollments.filter(
    (e) =>
      e.program_id === program &&
      ["active", "hold", "pending"].includes(e.enrollment_status) &&
      participants.get(e.participant_id)?.status === "active",
  );
  const filtered = eligible.filter(
    (e) =>
      !query ||
      `${participants.get(e.participant_id)?.display_name} ${participants.get(e.participant_id)?.global_participant_number} ${e.enrollment_number}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 15));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * 15, safePage * 15);
  const selected = eligible.filter((e) => ids.has(e.id));
  const allVisible = visible.length > 0 && visible.every((e) => ids.has(e.id));
  const validate = () =>
    !program || !selected.length
      ? "Pilih program dan minimal satu peserta."
      : selected.length > 200
        ? "Maksimal 200 peserta per pembuatan tagihan."
        : !form.title.trim() || !validMoney(form.amount)
          ? "Isi judul dan nominal tagihan yang benar."
          : form.invoice_type === "spp" && !form.billing_month
            ? "Pilih periode tagihan bulanan."
            : "";
  function next() {
    const message =
      step === 0
        ? !program || !selected.length
          ? "Pilih program dan minimal satu peserta."
          : selected.length > 200
            ? "Maksimal 200 peserta."
            : ""
        : validate();
    if (message) setError(message);
    else {
      setError("");
      setStep(step + 1);
    }
  }
  async function save() {
    const message = validate();
    if (message) {
      setError(message);
      return;
    }
    setBusy(true);
    setError("");
    const payload = {
      program_id: program,
      enrollment_ids: selected.map((e) => e.id).sort(),
      title: form.title.trim(),
      invoice_type: form.invoice_type,
      amount: Number(form.amount),
      billing_month:
        form.invoice_type === "spp" ? `${form.billing_month}-01` : null,
      due_date: form.due_date || null,
    };
    try {
      const result = await financeRpc<{
        created: number;
        invoice_ids: string[];
      }>("finance_create_invoices", {
        p_payload: payload,
        p_request_key: requestKey(payload),
      });
      if (
        result.created !== selected.length ||
        result.invoice_ids?.length !== selected.length
      )
        throw new Error(
          "Tagihan belum terkonfirmasi. Coba lagi dengan pilihan yang sama.",
        );
      onSaved(result.invoice_ids);
    } catch (problem) {
      setError(financeError(problem));
    } finally {
      setBusy(false);
    }
  }
  return (
    <FinanceWizardFrame
      title="Buat tagihan kelas"
      steps={["Peserta", "Rincian biaya", "Tinjau"]}
      step={step}
      onClose={onClose}
      onBack={() => {
        setStep(step - 1);
        setError("");
      }}
      onNext={next}
      onSubmit={() => void save()}
      busy={busy}
      error={error}
      dirty={ids.size > 0 || JSON.stringify(form) !== initial.current}
      submitLabel="Buat tagihan"
    >
      {step === 0 ? (
        <div className="space-y-4">
          <label className="certificate-field">
            Program
            <select
              aria-label="Program tagihan"
              className="field-control"
              value={program}
              onChange={(e) => {
                setProgram(e.target.value);
                setIds(new Set());
                setPage(1);
              }}
            >
              <option value="">Pilih program</option>
              {data.programs
                .filter((p) => p.status !== "archived")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          <Input
            aria-label="Cari peserta tagihan"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Cari nama atau nomor induk…"
          />
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                aria-label="Pilih halaman peserta tagihan"
                checked={allVisible}
                disabled={!visible.length}
                onChange={() =>
                  setIds((current) => {
                    const next = new Set(current);
                    visible.forEach((e) =>
                      allVisible ? next.delete(e.id) : next.add(e.id),
                    );
                    return next;
                  })
                }
              />
              Pilih halaman ini
            </label>
            <span>{selected.length} dipilih</span>
            <Button size="sm" variant="ghost" onClick={() => setIds(new Set())}>
              Bersihkan
            </Button>
          </div>
          <div className="finance-roster">
            {visible.map((e) => (
              <label key={e.id}>
                <input
                  type="checkbox"
                  checked={ids.has(e.id)}
                  onChange={() =>
                    setIds((current) => {
                      const next = new Set(current);
                      if (next.has(e.id)) next.delete(e.id);
                      else next.add(e.id);
                      return next;
                    })
                  }
                />
                <span>
                  {participants.get(e.participant_id)?.display_name}
                  <small>
                    {e.enrollment_number} ·{" "}
                    {
                      participants.get(e.participant_id)
                        ?.global_participant_number
                    }
                  </small>
                </span>
              </label>
            ))}
            {!visible.length && (
              <p className="certificate-empty">
                Tidak ada enrollment yang cocok.
              </p>
            )}
          </div>
          <FinancePagination page={safePage} pages={pages} onChange={setPage} />
        </div>
      ) : step === 1 ? (
        <div className="space-y-4">
          <label className="certificate-field">
            Jenis biaya
            <select
              aria-label="Jenis tagihan"
              className="field-control"
              value={form.invoice_type}
              onChange={(e) =>
                setForm({ ...form, invoice_type: e.target.value })
              }
            >
              <option value="education_infaq">Biaya kelas sekali bayar</option>
              <option value="spp">Biaya kelas bulanan</option>
              <option value="registration">Biaya pendaftaran</option>
            </select>
          </label>
          <label className="certificate-field">
            Judul tagihan
            <Input
              maxLength={160}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label className="certificate-field">
            Nominal per peserta (Rp)
            <Input
              aria-label="Nominal tagihan"
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </label>
          {form.invoice_type === "spp" && (
            <label className="certificate-field">
              Periode
              <Input
                aria-label="Periode tagihan"
                type="month"
                value={form.billing_month}
                onChange={(e) =>
                  setForm({ ...form, billing_month: e.target.value })
                }
              />
            </label>
          )}
          <label className="certificate-field">
            Jatuh tempo (opsional)
            <Input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </label>
        </div>
      ) : (
        <div className="space-y-4">
          <dl className="certificate-summary">
            <div>
              <dt>Program</dt>
              <dd>{data.programs.find((p) => p.id === program)?.name}</dd>
            </div>
            <div>
              <dt>Tagihan</dt>
              <dd>{form.title}</dd>
            </div>
            <div>
              <dt>Per peserta</dt>
              <dd>{rupiah(form.amount)}</dd>
            </div>
            <div>
              <dt>Jumlah</dt>
              <dd>
                {selected.length} peserta ·{" "}
                {rupiah(Number(form.amount) * selected.length)}
              </dd>
            </div>
            {form.invoice_type === "spp" && (
              <div>
                <dt>Periode</dt>
                <dd>{form.billing_month}</dd>
              </div>
            )}
            <div>
              <dt>Jatuh tempo</dt>
              <dd>{form.due_date || "Tidak ditentukan"}</dd>
            </div>
          </dl>
          <details className="program-disclosure">
            <summary>Daftar peserta ({selected.length})</summary>
            <div className="p-4 space-y-2">
              {selected.map((e) => (
                <p key={e.id} className="text-sm">
                  {participants.get(e.participant_id)?.display_name} ·{" "}
                  {e.enrollment_number}
                </p>
              ))}
            </div>
          </details>
          <p className="program-notice">
            Tagihan akan tampil pada akun peserta. Status belajar tetap
            dipertahankan.
          </p>
        </div>
      )}
    </FinanceWizardFrame>
  );
}
