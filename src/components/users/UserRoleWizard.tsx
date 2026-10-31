import { useState } from "react";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { Dialog } from "../ui/dialog";
import { Button } from "../ui/button";
import { WizardSteps } from "../ui/wizard-steps";
import { supabase } from "../../lib/supabase";
import {
  userChangeError,
  userName,
  userRoleLabels,
  userRoleHints,
  userScopeModes,
  usersError,
  type UserDetail,
  type UserAssignment,
  type UserChange,
} from "../../lib/usersWorkspace";
export function UserRoleWizard({
  data,
  assignment,
  actor,
  onClose,
  onReload,
  onSaved,
}: {
  data: UserDetail;
  assignment?: UserAssignment;
  actor: string;
  onClose: () => void;
  onReload: () => void;
  onSaved: (value: UserDetail) => void;
}) {
  const [step, setStep] = useState(0),
    [role, setRole] = useState(""),
    [scope, setScope] = useState("global"),
    [scopeId, setScopeId] = useState(""),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const removing = !!assignment;
  const change: UserChange = removing
    ? { operation: "revoke", assignment_id: assignment.id, reason }
    : {
        operation: "grant",
        role,
        scope_type: scope === "global" ? null : scope,
        scope_id: scopeId || null,
        reason,
      };
  const selectedName =
    scope === "unit"
      ? data.options.units.find((x) => x.id === scopeId)?.name
      : scope === "program"
        ? data.options.programs.find((x) => x.id === scopeId)?.name
        : ["participant", "guardian"].includes(role)
          ? "Data sendiri"
          : "Umum";
  const roleName = removing
    ? (userRoleLabels[assignment.code] ?? assignment.name)
    : (userRoleLabels[role] ?? "Pilih peran");
  function next() {
    setError("");
    if (step === 0 && !removing && !role) {
      setError("Pilih peran terlebih dahulu.");
      return;
    }
    if (step === 1) {
      const message = userChangeError(change, data, actor);
      if (message) {
        setError(message);
        return;
      }
    }
    setStep((n) => n + 1);
  }
  async function save() {
    const message = userChangeError(change, data, actor);
    if (message) {
      setError(message);
      setStep(1);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await supabase.rpc("system_user_role_change", {
        p_user: data.profile.id,
        p_revision: data.revision,
        p_change: change,
      });
      if (r.error) throw r.error;
      if (
        r.data?.profile?.id !== data.profile.id ||
        !r.data?.revision ||
        !Array.isArray(r.data?.assignments)
      )
        throw new Error("Perubahan belum terkonfirmasi. Muat ulang pengguna.");
      onSaved(r.data as UserDetail);
    } catch (e) {
      setError(usersError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={removing ? "Lepas penugasan peran" : "Tambah penugasan peran"}
      onClose={onClose}
      busy={busy}
      className="users-role-dialog"
    >
      <WizardSteps
        steps={["Peran", "Cakupan & alasan", "Tinjau"]}
        current={step}
      />
      <div className="users-wizard-identity">
        <ShieldCheck size={21} />
        <div>
          <strong>{userName(data.profile)}</strong>
          <small>{data.profile.email || "Email belum tersedia"}</small>
        </div>
      </div>
      {step === 0 ? (
        <>
          {removing ? (
            <div className="users-role-review">
              <strong>{roleName}</strong>
              <p>{assignment.scope_name}</p>
              <small>Hanya penugasan ini yang dilepas.</small>
            </div>
          ) : (
            <label className="users-form-field">
              Peran
              <select
                className="field-control"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  setScope(
                    e.target.value === "admin"
                      ? "unit"
                      : e.target.value === "helpdesk"
                        ? "program"
                        : "global",
                  );
                  setScopeId("");
                  setError("");
                }}
              >
                <option value="">Pilih peran</option>
                {data.options.roles
                  .filter((r) => Object.hasOwn(userRoleLabels, r.code))
                  .map((r) => (
                    <option key={r.id} value={r.code}>
                      {userRoleLabels[r.code]}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {(role || assignment) && (
            <p className="users-hint">
              {userRoleHints[assignment?.code ?? role]}
            </p>
          )}
        </>
      ) : step === 1 ? (
        <>
          {!removing ? (
            <div className="users-scope-fields">
              <label className="users-form-field">
                Cakupan
                <select
                  className="field-control"
                  value={scope}
                  onChange={(e) => {
                    setScope(e.target.value);
                    setScopeId("");
                  }}
                >
                  {userScopeModes(role).map((s) => (
                    <option key={s} value={s}>
                      {s === "global"
                        ? (["participant", "guardian"].includes(role) ? "Data sendiri" : "Umum")
                        : s === "unit"
                          ? "Unit tertentu"
                          : "Program tertentu"}
                    </option>
                  ))}
                </select>
              </label>
              {scope !== "global" && (
                <label className="users-form-field">
                  {scope === "unit" ? "Unit" : "Program"}
                  <select
                    className="field-control"
                    value={scopeId}
                    onChange={(e) => setScopeId(e.target.value)}
                  >
                    <option value="">
                      Pilih {scope === "unit" ? "unit" : "program"}
                    </option>
                    {(scope === "unit"
                      ? data.options.units
                      : data.options.programs
                    )
                      .filter((o) => o.status === "active")
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <p className="users-hint">{userRoleHints[role]}</p>
            </div>
          ) : (
            <p className="users-hint">
              Lepas {roleName} · {assignment.scope_name}. Penugasan lain tetap
              terpisah.
            </p>
          )}
          <label className="users-form-field">
            Alasan perubahan
            <textarea
              className="field-control"
              maxLength={1000}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: penugasan pengajar semester baru"
            />
          </label>
        </>
      ) : (
        <section className="users-role-review">
          <h3>{removing ? "Lepas peran" : "Tambahkan peran"}</h3>
          <dl>
            <div>
              <dt>Pengguna</dt>
              <dd>{userName(data.profile)}</dd>
            </div>
            <div>
              <dt>Peran</dt>
              <dd>{roleName}</dd>
            </div>
            <div>
              <dt>Cakupan</dt>
              <dd>{removing ? assignment.scope_name : selectedName}</dd>
            </div>
            <div>
              <dt>Alasan</dt>
              <dd>{reason}</dd>
            </div>
          </dl>
          {(role === "super_admin" || assignment?.code === "super_admin") && (
            <p className="users-warning">
              Peran superadmin memiliki akses pengelolaan seluruh sistem.
            </p>
          )}
          <p className="users-hint">
            Perubahan dicatat di audit. Menu pengguna diperbarui saat sesi
            dimuat ulang.
          </p>
        </section>
      )}
      {error && (
        <div className="users-error" role="alert">
          <p>{error}</p>
          {step === 2 && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={onReload}
            >
              Muat ulang pengguna
            </Button>
          )}
        </div>
      )}
      <footer className="workspace-dialog__footer">
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => (step ? setStep((n) => n - 1) : onClose())}
        >
          {step ? "Kembali" : "Batal"}
        </Button>
        {step < 2 ? (
          <Button onClick={next}>
            Lanjut
            <ArrowRight size={15} />
          </Button>
        ) : (
          <Button disabled={busy} onClick={() => void save()}>
            {busy
              ? "Menyimpan…"
              : removing
                ? "Lepas penugasan"
                : "Simpan penugasan"}
          </Button>
        )}
      </footer>
    </Dialog>
  );
}
