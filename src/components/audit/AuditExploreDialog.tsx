import { useState } from "react";
import { ArrowLeft, ArrowRight, Search } from "lucide-react";
import { Dialog } from "../ui/dialog";
import { Button } from "../ui/button";
import {
  auditCategories,
  auditEntityLabel,
  auditPeriod,
  type AuditCategory,
} from "../../lib/auditWorkspace";
export function AuditExploreDialog({
  entities,
  onClose,
  onApply,
}: {
  entities: string[];
  onClose: () => void;
  onApply: (p: Record<string, string>) => void;
}) {
  const [step, setStep] = useState(1),
    [category, setCategory] = useState<AuditCategory>("all"),
    [entity, setEntity] = useState("all"),
    [period, setPeriod] = useState("7");
  const dates =
    period === "all" ? { from: "", to: "" } : auditPeriod(Number(period));
  return (
    <Dialog
      title="Telusuri aktivitas"
      onClose={onClose}
      className="audit-explore-dialog"
    >
      <ol className="audit-steps" aria-label="Langkah penelusuran">
        <li aria-current={step === 1 ? "step" : undefined}>1. Pilih fokus</li>
        <li aria-current={step === 2 ? "step" : undefined}>2. Tinjau filter</li>
      </ol>
      {step === 1 ? (
        <div className="audit-explore-fields">
          <label>
            Jenis aktivitas
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as AuditCategory)}
            >
              {Object.entries(auditCategories).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Objek
            <select value={entity} onChange={(e) => setEntity(e.target.value)}>
              <option value="all">Semua objek</option>
              {entities.map((v) => (
                <option value={v} key={v}>
                  {auditEntityLabel(v)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Periode
            <select value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="7">7 hari terakhir</option>
              <option value="30">30 hari terakhir</option>
              <option value="all">Seluruh waktu</option>
            </select>
          </label>
        </div>
      ) : (
        <div className="audit-explore-review">
          <dl className="audit-facts">
            <div>
              <dt>Jenis aktivitas</dt>
              <dd>{auditCategories[category]}</dd>
            </div>
            <div>
              <dt>Objek</dt>
              <dd>
                {entity === "all" ? "Semua objek" : auditEntityLabel(entity)}
              </dd>
            </div>
            <div>
              <dt>Periode (WIB)</dt>
              <dd>
                {period === "all"
                  ? "Seluruh waktu"
                  : dates.from + " — " + dates.to}
              </dd>
            </div>
          </dl>
          <p className="audit-muted">Membuka hasil dengan filter di atas.</p>
        </div>
      )}
      <footer className="audit-dialog-footer">
        {step === 2 ? (
          <Button variant="outline" onClick={() => setStep(1)}>
            <ArrowLeft size={16} />
            Kembali
          </Button>
        ) : (
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
        )}
        {step === 1 ? (
          <Button onClick={() => setStep(2)}>
            Tinjau
            <ArrowRight size={16} />
          </Button>
        ) : (
          <Button onClick={() => onApply({ category, entity, ...dates })}>
            <Search size={16} />
            Lihat aktivitas
          </Button>
        )}
      </footer>
    </Dialog>
  );
}
