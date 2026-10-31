import { useEffect, useRef, useState } from "react";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Input } from "../ui/input";
import { WizardSteps } from "../ui/wizard-steps";
import {
  announcementRpc,
  useAnnouncementKey,
} from "../../lib/announcementData";
import {
  announcementDate,
  announcementError,
  announcementInstant,
  announcementLocal,
  announcementPayload,
  announcementRoles,
  announcementState,
  validateAnnouncement,
  type Announcement,
  type AnnouncementClass,
  type AnnouncementForm,
  type AnnouncementProgram,
} from "../../lib/announcementWorkspace";
import { AnnouncementMessage } from "./AnnouncementShared";
export function AnnouncementEditor({
  item,
  duplicate = false,
  programs,
  classes,
  globalAllowed,
  initialProgram,
  onClose,
  onSaved,
}: {
  item?: Announcement;
  duplicate?: boolean;
  programs: AnnouncementProgram[];
  classes: AnnouncementClass[];
  globalAllowed: boolean;
  initialProgram: string;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { user, profile } = useAuthSession();
  const snapshot = useRef(item);
  const original = snapshot.current;
  const editing = !!original && !duplicate;
  const cacheKey = `ypia:announcement:${user?.id ?? profile?.id ?? "session"}:${editing ? original!.id + ":" + original!.updated_at : duplicate && original ? "copy:" + original.id + ":" + original.updated_at : "new:" + initialProgram}`;
  const restored = useRef(false);
  const [form, setForm] = useState<AnnouncementForm>(() => {
    const initial: AnnouncementForm = {
      title: original ? (duplicate ? "Salinan: " : "") + original.title : "",
      content: original?.content ?? "",
      target_role: original?.target_role ?? "all",
      target_program_id:
        original?.target_program_id ??
        (["all", "global"].includes(initialProgram) ? "" : initialProgram),
      target_class_id: original?.target_class_id ?? "",
      mode:
        editing && original!.status === "published"
          ? announcementState(original!) === "scheduled"
            ? "schedule"
            : "now"
          : "draft",
      publish_at: announcementLocal(original?.publish_at),
      expires_at: duplicate ? "" : announcementLocal(original?.expires_at),
      is_pinned: duplicate ? false : (original?.is_pinned ?? false),
      action_kind:
        original?.action_kind === "lesson"
          ? "program"
          : (original?.action_kind ?? "none"),
    };
    try {
      const saved = JSON.parse(sessionStorage.getItem(cacheKey) ?? "null");
      if (
        saved &&
        typeof saved.savedAt === "number" &&
        Date.now() - saved.savedAt < 86400000 &&
        saved.form &&
        Object.keys(initial).every(
          (key) =>
            typeof saved.form[key] ===
            typeof initial[key as keyof AnnouncementForm],
        )
      ) {
        restored.current = true;
        return saved.form as AnnouncementForm;
      }
    } catch {
      /* Use the server snapshot when local storage cannot be read. */
    }
    return initial;
  });
  const baseline = useRef(JSON.stringify(form));
  const [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [discard, setDiscard] = useState(false),
    [localError, setLocalError] = useState(false);
  const [audience, setAudience] = useState<{
      key: string;
      count: number;
    } | null>(null),
    [countBusy, setCountBusy] = useState(false),
    [countError, setCountError] = useState("");
  const [refreshCount, setRefreshCount] = useState(0);
  const requestKey = useAnnouncementKey();
  const dirty = restored.current || JSON.stringify(form) !== baseline.current;
  const audienceKey = JSON.stringify([
    form.target_role,
    form.target_program_id,
    form.target_class_id,
  ]);
  useEffect(() => {
    if (!dirty) return;
    try {
      sessionStorage.setItem(
        cacheKey,
        JSON.stringify({ form, savedAt: Date.now() }),
      );
      setLocalError(false);
    } catch {
      setLocalError(true);
    }
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [form, cacheKey, dirty]);
  useEffect(() => {
    if (step < 1) return;
    let active = true;
    setCountBusy(true);
    setCountError("");
    setAudience(null);
    void announcementRpc<{ recipients: number }>(
      "admin_announcement_audience",
      {
        p_role: form.target_role,
        p_program: form.target_program_id || null,
        p_class: form.target_class_id || null,
      },
    )
      .then((r) => {
        if (!Number.isSafeInteger(r.recipients) || r.recipients < 0)
          throw new Error("Perkiraan penerima belum terkonfirmasi. Coba lagi.");
        if (active) setAudience({ key: audienceKey, count: r.recipients });
      })
      .catch((e) => {
        if (active) setCountError(announcementError(e));
      })
      .finally(() => {
        if (active) setCountBusy(false);
      });
    return () => {
      active = false;
    };
  }, [
    step,
    audienceKey,
    form.target_role,
    form.target_program_id,
    form.target_class_id,
    refreshCount,
  ]);
  function validateTarget() {
    if (!globalAllowed && !form.target_program_id)
      return "Pilih program sesuai cakupan Anda.";
    if (
      form.target_program_id &&
      !programs.some((p) => p.id === form.target_program_id)
    )
      return "Program tidak tersedia untuk akun Anda.";
    if (
      form.target_class_id &&
      !classes.some(
        (c) =>
          c.id === form.target_class_id &&
          c.program_id === form.target_program_id,
      )
    )
      return "Kelas tidak sesuai program.";
    return "";
  }
  function next() {
    const problem =
      step === 0
        ? !form.title.trim() ||
          form.title.trim().length > 160 ||
          !form.content.trim() ||
          form.content.trim().length > 8000
          ? "Lengkapi judul dan isi pesan."
          : ""
        : validateTarget();
    if (problem) setError(problem);
    else {
      setError("");
      setStep(step + 1);
    }
  }
  async function save() {
    const problem = validateTarget() || validateAnnouncement(form);
    if (problem) {
      setError(problem);
      return;
    }
    if (
      form.mode !== "draft" &&
      (!audience || audience.key !== audienceKey || countBusy)
    ) {
      setError("Periksa perkiraan penerima sebelum menayangkan.");
      return;
    }
    setBusy(true);
    setError("");
    const payload = {
      ...announcementPayload(form),
      id: editing ? original!.id : null,
      expected_updated_at: editing ? original!.updated_at : null,
    };
    try {
      const result = await announcementRpc<{ id: string; status: string }>(
        "admin_save_announcement",
        { p_payload: payload, p_request_key: requestKey(payload) },
      );
      if (!result.id || result.status !== payload.status)
        throw new Error(
          "Pengumuman belum terkonfirmasi. Coba lagi dengan isian yang sama.",
        );
      try {
        sessionStorage.removeItem(cacheKey);
      } catch {
        /* A saved server draft remains authoritative. */
      }
      onSaved(result.id);
    } catch (e) {
      setError(announcementError(e));
    } finally {
      setBusy(false);
    }
  }
  const preview: Announcement = {
    id: "preview",
    title: form.title,
    content: form.content,
    target_role: form.target_role,
    target_program_id: form.target_program_id || null,
    target_class_id: form.target_class_id || null,
    status: form.mode === "draft" ? "draft" : "published",
    publish_at:
      form.mode === "schedule"
        ? announcementInstant(form.publish_at)
        : new Date().toISOString(),
    expires_at: form.expires_at ? announcementInstant(form.expires_at) : null,
    is_pinned: form.is_pinned,
    action_kind: form.action_kind,
    source: "manual",
    source_lesson_id: null,
    revision: 1,
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    program_name: programs.find((p) => p.id === form.target_program_id)?.name,
    class_name: classes.find((c) => c.id === form.target_class_id)?.name,
  };
  return (
    <Dialog
      title={
        editing
          ? "Ubah pengumuman"
          : duplicate
            ? "Salin pengumuman"
            : "Buat pengumuman"
      }
      onClose={() => (dirty ? setDiscard(true) : onClose())}
      busy={busy}
      className="announcement-editor-dialog"
    >
      <WizardSteps steps={["Pesan", "Penerima", "Tinjau"]} current={step} />
      {restored.current && (
        <p className="announcement-local-note">
          Isian sebelumnya dipulihkan dari perangkat ini.
        </p>
      )}
      {localError && (
        <p className="program-error" role="alert">
          Isian belum dapat disimpan di perangkat. Simpan sebagai draf sebelum
          menutup.
        </p>
      )}
      {error && (
        <p className="program-error mb-4" role="alert">
          {error}
        </p>
      )}
      {step === 0 ? (
        <div className="space-y-4">
          <label className="certificate-field">
            Judul
            <Input
              aria-label="Judul pengumuman"
              maxLength={160}
              placeholder="Contoh: Jadwal pertemuan pekan ini"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <small>{form.title.length}/160</small>
          </label>
          <label className="certificate-field">
            Isi pesan
            <textarea
              aria-label="Isi pengumuman"
              className="field-control announcement-content-input"
              maxLength={8000}
              placeholder="Tuliskan informasi dan tindakan yang perlu dilakukan."
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
            />
            <small>{form.content.length.toLocaleString("id-ID")}/8.000</small>
          </label>
          <label className="certificate-field">
            Tombol tindakan
            <select
              aria-label="Tombol tindakan pengumuman"
              className="field-control"
              value={form.action_kind}
              onChange={(e) =>
                setForm({
                  ...form,
                  action_kind: e.target
                    .value as AnnouncementForm["action_kind"],
                })
              }
            >
              <option value="none">Tanpa tombol</option>
              <option value="program">Buka program</option>
              <option value="payment">Buka pembayaran</option>
              <option value="help">Buka bantuan</option>
            </select>
          </label>
        </div>
      ) : step === 1 ? (
        <div className="space-y-4">
          <label className="certificate-field">
            Peran penerima
            <select
              aria-label="Peran penerima"
              className="field-control"
              value={form.target_role}
              onChange={(e) =>
                setForm({
                  ...form,
                  target_role: e.target
                    .value as AnnouncementForm["target_role"],
                })
              }
            >
              {Object.entries(announcementRoles).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="certificate-field">
            Program
            <select
              aria-label="Program penerima"
              className="field-control"
              value={form.target_program_id}
              onChange={(e) =>
                setForm({
                  ...form,
                  target_program_id: e.target.value,
                  target_class_id: "",
                })
              }
            >
              <option value="">
                {globalAllowed ? "Semua program" : "Pilih program"}
              </option>
              {programs.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                  {p.status === "archived" ? " · Arsip" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="certificate-field">
            Kelas
            <select
              aria-label="Kelas penerima"
              className="field-control"
              disabled={!form.target_program_id}
              value={form.target_class_id}
              onChange={(e) =>
                setForm({ ...form, target_class_id: e.target.value })
              }
            >
              <option value="">Semua kelas dalam program</option>
              {classes
                .filter((c) => c.program_id === form.target_program_id)
                .map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                    {c.status !== "active" ? " · Nonaktif" : ""}
                  </option>
                ))}
            </select>
          </label>
          <div className="announcement-audience-estimate">
            {countBusy ? (
              "Menghitung penerima…"
            ) : audience ? (
              <>
                Perkiraan penerima <strong>{audience.count} akun</strong>
              </>
            ) : (
              countError || "Perkiraan penerima belum tersedia."
            )}
            {countError && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRefreshCount((n) => n + 1)}
              >
                Coba lagi
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Cakupan dihitung dari peran, enrollment, wali, dan penugasan yang
            berlaku saat ini.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <AnnouncementMessage
            item={preview}
            role={form.target_role === "all" ? "participant" : form.target_role}
            preview
          />
          <section className="announcement-publish-options">
            <label className="certificate-field">
              Publikasi
              <select
                aria-label="Pilihan publikasi"
                className="field-control"
                value={form.mode}
                onChange={(e) =>
                  setForm({
                    ...form,
                    mode: e.target.value as AnnouncementForm["mode"],
                  })
                }
              >
                <option value="draft">Simpan sebagai draf</option>
                <option value="now">Tayangkan sekarang</option>
                <option value="schedule">Jadwalkan</option>
              </select>
            </label>
            {form.mode === "schedule" && (
              <label className="certificate-field">
                Tayang mulai (WIB)
                <Input
                  aria-label="Jadwal tayang WIB"
                  type="datetime-local"
                  value={form.publish_at}
                  onChange={(e) =>
                    setForm({ ...form, publish_at: e.target.value })
                  }
                />
              </label>
            )}
            <label className="certificate-field">
              Berakhir pada (opsional, WIB)
              <Input
                aria-label="Waktu berakhir WIB"
                type="datetime-local"
                value={form.expires_at}
                onChange={(e) =>
                  setForm({ ...form, expires_at: e.target.value })
                }
              />
            </label>
            <label className="flex gap-2 items-center text-sm">
              <input
                type="checkbox"
                checked={form.is_pinned}
                onChange={(e) =>
                  setForm({ ...form, is_pinned: e.target.checked })
                }
              />
              Sematkan di urutan teratas
            </label>
            <p className="text-sm">
              {countBusy
                ? "Menghitung penerima…"
                : audience
                  ? `${audience.count} akun dalam sasaran saat ini`
                  : countError || "Perkiraan penerima belum tersedia."}
              {countError && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRefreshCount((n) => n + 1)}
                >
                  Coba lagi
                </Button>
              )}
            </p>
            {form.mode !== "draft" && audience?.count === 0 && (
              <p className="program-notice">
                Belum ada akun yang sesuai sasaran. Pengumuman dapat terlihat
                ketika keanggotaan penerima berubah.
              </p>
            )}
            {form.mode === "schedule" && form.publish_at && (
              <p className="text-xs text-muted-foreground">
                Mulai {announcementDate(announcementInstant(form.publish_at))}.
                Jadwal menggunakan WIB.
              </p>
            )}
          </section>
        </div>
      )}
      <footer className="workspace-dialog__footer">
        <Button
          variant="outline"
          disabled={busy}
          onClick={
            step
              ? () => {
                  setStep(step - 1);
                  setError("");
                }
              : () => (dirty ? setDiscard(true) : onClose())
          }
        >
          {step ? "Kembali" : "Tutup"}
        </Button>
        <span className="text-xs text-muted-foreground">{step + 1}/3</span>
        <Button disabled={busy} onClick={step < 2 ? next : () => void save()}>
          {busy
            ? "Menyimpan…"
            : step < 2
              ? "Lanjut"
              : form.mode === "draft"
                ? "Simpan draf"
                : form.mode === "schedule"
                  ? "Simpan jadwal"
                  : editing
                    ? "Simpan & tayangkan"
                    : "Tayangkan"}
        </Button>
      </footer>
      {discard && (
        <Dialog title="Tutup pengisian?" onClose={() => setDiscard(false)}>
          <p className="text-sm">
            {localError
              ? "Isian belum tersimpan di perangkat."
              : "Isian tersimpan sementara di perangkat ini dan belum menjadi draf server."}
          </p>
          <footer className="workspace-dialog__footer">
            <Button variant="outline" onClick={() => setDiscard(false)}>
              Lanjut mengisi
            </Button>
            <Button onClick={onClose}>
              {localError ? "Tutup tanpa menyimpan" : "Tutup & lanjut nanti"}
            </Button>
          </footer>
        </Dialog>
      )}
    </Dialog>
  );
}
