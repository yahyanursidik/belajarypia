import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  ExternalLink,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { WizardSteps } from "../ui/wizard-steps";
import { useAuthSession } from "../../app/providers/authSessionContext";
import {
  fromDateTimeLocalValue,
  toDateTimeLocalValue,
  type GroupSettings,
} from "../../lib/admission";
import {
  admissionMutationError,
  draftFromForm,
  validateAdmissionDraft,
  type AdmissionField,
  type AdmissionForm,
  type AdmissionProgram,
  type FormDraft,
} from "../../lib/admissionWorkspace";
import { supabase } from "../../lib/supabase";
type Claim = { group_bucket: string; group_index: number };
type Bucket = "general_groups" | "ikhwan_groups" | "akhwat_groups";
const steps = ["Pengaturan", "Pertanyaan", "Undangan grup", "Tinjau"];
export function AdmissionFormEditor({
  programId,
  onFlagsChanged,
  onSaved,
}: {
  programId: string;
  onFlagsChanged?: (flags: Record<string, unknown>) => void;
  onSaved?: () => void;
}) {
  const { user } = useAuthSession();
  const storageKey = `ypia:admission-draft:${user?.id ?? "unknown"}:${programId}`;
  const [program, setProgram] = useState<AdmissionProgram | null>(null);
  const [draft, setDraft] = useState<FormDraft | null>(null);
  const [baseline, setBaseline] = useState("");
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [claims, setClaims] = useState<Claim[]>([]);
  const [claimsError, setClaimsError] = useState(false);
  const [otherActiveForms, setOtherActiveForms] = useState(false);
  const [reload, setReload] = useState(0);
  const ignoreStored = useRef(false);
  const [removeQuestion, setRemoveQuestion] = useState<number | null>(null);
  const [discardConfirm, setDiscardConfirm] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    void (async () => {
      try {
        const [programResult, formResult] = await Promise.all([
          supabase
            .from("programs")
            .select("id,code,name,status,curriculum_model,feature_flags")
            .eq("id", programId)
            .abortSignal(controller.signal)
            .single(),
          supabase
            .from("registration_forms")
            .select("*")
            .eq("program_id", programId)
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .abortSignal(controller.signal),
        ]);
        if (controller.signal.aborted) return;
        if (programResult.error || formResult.error || !programResult.data)
          throw new Error();
        const forms = (formResult.data ?? []) as AdmissionForm[];
        const form = forms[0] ?? null;
        setOtherActiveForms(
          forms.some((row) => row.id !== form?.id && row.status === "active"),
        );
        let fields: AdmissionField[] = [];
        if (form) {
          const [fieldResult, claimResult] = await Promise.all([
            supabase
              .from("registration_form_fields")
              .select("*")
              .eq("form_id", form.id)
              .order("order_no")
              .abortSignal(controller.signal),
            supabase
              .from("registration_group_link_claims")
              .select("group_bucket,group_index")
              .eq("form_id", form.id)
              .abortSignal(controller.signal),
          ]);
          if (controller.signal.aborted) return;
          if (fieldResult.error) throw fieldResult.error;
          fields = fieldResult.data ?? [];
          setClaims(claimResult.data ?? []);
          setClaimsError(!!claimResult.error);
        } else {
          setClaims([]);
          setClaimsError(false);
        }
        const current = programResult.data as AdmissionProgram;
        const serverDraft = draftFromForm(form, current, fields);
        setProgram(current);
        setBaseline(JSON.stringify(serverDraft));
        let next = serverDraft;
        if (!ignoreStored.current) {
          try {
            const saved = JSON.parse(
              sessionStorage.getItem(storageKey) || "null",
            ) as FormDraft | null;
            if (
              saved &&
              Array.isArray(saved.fields) &&
              saved.group_settings &&
              typeof saved.title === "string"
            ) {
              next = saved;
              setMessage("Draf terakhir dipulihkan.");
            }
          } catch {
            /* A damaged local draft never prevents loading server data. */
          }
        }
        ignoreStored.current = false;
        setDraft(next);
      } catch {
        if (!controller.signal.aborted)
          setLoadError("Pengaturan formulir belum dapat dimuat. Coba lagi.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [programId, storageKey, reload]);
  const dirty = !!draft && JSON.stringify(draft) !== baseline;
  useEffect(() => {
    if (!draft || loading) return;
    try {
      if (dirty) sessionStorage.setItem(storageKey, JSON.stringify(draft));
      else sessionStorage.removeItem(storageKey);
    } catch {
      /* Saving on the server remains available when browser storage is full. */
    }
  }, [draft, loading, dirty, storageKey]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function change(patch: Partial<FormDraft>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
    setError("");
    setMessage("");
  }
  function changeField(index: number, patch: Partial<AdmissionField>) {
    if (!draft) return;
    change({
      fields: draft.fields.map((field, i) =>
        i === index ? { ...field, ...patch } : field,
      ),
    });
  }
  function moveField(index: number, amount: number) {
    if (!draft) return;
    const fields = [...draft.fields];
    [fields[index], fields[index + amount]] = [
      fields[index + amount],
      fields[index],
    ];
    change({ fields });
  }
  function groupChange(patch: Partial<GroupSettings>) {
    if (draft)
      change({ group_settings: { ...draft.group_settings, ...patch } });
  }
  function changeGroup(
    bucket: Bucket,
    index: number,
    patch: Record<string, unknown>,
  ) {
    if (!draft) return;
    groupChange({
      [bucket]: draft.group_settings[bucket].map((group, i) =>
        i === index ? { ...group, ...patch } : group,
      ),
    });
  }
  function newQuestion() {
    if (!draft) return;
    change({
      fields: [
        ...draft.fields,
        {
          field_key: `q_${crypto.randomUUID().replaceAll("-", "")}`,
          label: "",
          field_type: "text",
          is_required: false,
          options_json: null,
          order_no: draft.fields.length,
        },
      ],
    });
  }
  function resetDraft() {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* optional local cache */
    }
    ignoreStored.current = true;
    setStep(0);
    setError("");
    setMessage("");
    setReload((value) => value + 1);
  }
  async function save() {
    if (!draft || !program || busy) return;
    const problem = validateAdmissionDraft(draft, program);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { data, error } = await supabase.rpc("admin_save_admission_form", {
        p_program_id: programId,
        p_form_id: draft.id,
        p_expected_updated_at: draft.updated_at,
        p_payload: {
          title: draft.title,
          description: draft.description,
          status: draft.status,
          direct: draft.direct,
          registration_open_at: draft.registration_open_at,
          registration_close_at: draft.registration_close_at,
          group_settings: draft.group_settings,
        },
        p_fields: draft.fields.map((field, index) => ({
          ...field,
          order_no: index,
        })),
      });
      if (error) throw error;
      if (!data?.form_id || !data?.updated_at)
        throw new Error(
          "Server belum mengonfirmasi formulir. Muat ulang sebelum mengulang.",
        );
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        /* optional local cache */
      }
      ignoreStored.current = true;
      setDraft(null);
      setMessage("Formulir dan pengaturan pendaftaran tersimpan.");
      onFlagsChanged?.(data.feature_flags ?? {});
      onSaved?.();
      setReload((value) => value + 1);
    } catch (error) {
      setError(admissionMutationError(error));
    } finally {
      setBusy(false);
    }
  }
  async function copyLink() {
    if (!program || !draft) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${draft.direct ? "/katalog/" : "/pendaftaran/"}${program.id}`,
      );
      setMessage("Tautan pendaftaran disalin.");
    } catch {
      setError("Tautan belum dapat disalin. Gunakan tombol Buka halaman.");
    }
  }
  if (loading)
    return (
      <p role="status" className="program-loading">
        Memuat pengaturan formulir…
      </p>
    );
  if (loadError || !draft || !program)
    return (
      <div className="admission-empty">
        <p role="alert" className="program-error">
          {loadError || "Program belum tersedia."}
        </p>
        <Button
          variant="outline"
          onClick={() => setReload((value) => value + 1)}
        >
          Coba lagi
        </Button>
      </div>
    );
  const groups = draft.group_settings;
  const activeBuckets: Bucket[] = groups.separated_gender
    ? ["ikhwan_groups", "akhwat_groups", "general_groups"]
    : ["general_groups"];
  return (
    <section className="program-panel admission-form-editor">
      <div className="program-section-heading">
        <div>
          <h2>{draft.id ? "Pengaturan pendaftaran" : "Siapkan pendaftaran"}</h2>
          <p className="text-xs text-muted-foreground">
            {dirty || !draft.id
              ? "Draf belum disimpan"
              : "Pengaturan tersimpan"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void copyLink()}>
            <Copy size={14} />
            Salin tautan
          </Button>
          <Button asChild size="sm" variant="outline">
            <a
              href={`${draft.direct ? "/katalog/" : "/pendaftaran/"}${program.id}`}
              target="_blank"
              rel="noreferrer"
            >
              Buka halaman
              <ExternalLink size={14} />
            </a>
          </Button>
        </div>
      </div>
      <WizardSteps steps={steps} current={step} />
      {otherActiveForms && (
        <p className="program-notice">
          Masih ada formulir lama yang aktif. Menyimpan pengaturan ini akan
          mengarsipkan formulir aktif lain dalam program yang sama.
        </p>
      )}
      {message && (
        <p role="status" className="admission-notice">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="program-error">
          {error}
        </p>
      )}
      <fieldset disabled={busy} className="admission-wizard-content">
        {step === 0 && (
          <div className="space-y-5">
            <div
              className="admission-mode-options"
              role="radiogroup"
              aria-label="Cara pendaftaran"
            >
              {[
                {
                  value: false,
                  label: "Formulir & review",
                  description: "Calon peserta mengisi formulir.",
                },
                {
                  value: true,
                  label: "Daftar langsung",
                  description: "Peserta terdaftar melalui katalog.",
                },
              ].map((item) => (
                <label
                  key={String(item.value)}
                  className="admission-mode-option"
                >
                  <input
                    type="radio"
                    name="admission-mode"
                    checked={draft.direct === item.value}
                    onChange={() => change({ direct: item.value })}
                  />
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                </label>
              ))}
            </div>
            <div className="admission-form-grid-fields">
              <label>
                Judul formulir
                <Input
                  value={draft.title}
                  maxLength={180}
                  onChange={(event) => change({ title: event.target.value })}
                />
              </label>
              <label>
                Status formulir
                <select
                  className="field-control"
                  disabled={draft.direct}
                  value={draft.direct ? "draft" : draft.status}
                  onChange={(event) =>
                    change({
                      status: event.target.value as FormDraft["status"],
                    })
                  }
                >
                  <option value="draft">Draf</option>
                  <option value="active">Aktif</option>
                  <option value="archived">Arsip</option>
                </select>
              </label>
              <label className="admission-field-wide">
                Instruksi singkat
                <textarea
                  className="field-control min-h-20"
                  maxLength={4000}
                  value={draft.description}
                  onChange={(event) =>
                    change({ description: event.target.value })
                  }
                  placeholder="Petunjuk untuk calon peserta…"
                />
              </label>
              <label>
                Dibuka pada
                <Input
                  type="datetime-local"
                  disabled={draft.direct}
                  value={toDateTimeLocalValue(draft.registration_open_at)}
                  onChange={(event) =>
                    change({
                      registration_open_at: fromDateTimeLocalValue(
                        event.target.value,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Ditutup pada
                <Input
                  type="datetime-local"
                  disabled={draft.direct}
                  value={toDateTimeLocalValue(draft.registration_close_at)}
                  onChange={(event) =>
                    change({
                      registration_close_at: fromDateTimeLocalValue(
                        event.target.value,
                      ),
                    })
                  }
                />
              </label>
            </div>
            {draft.direct ? (
              <p className="program-notice">
                Formulir disimpan sebagai draf saat daftar langsung aktif.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Kosongkan tanggal untuk membuka tanpa batas waktu. Program harus
                aktif.
              </p>
            )}
          </div>
        )}
        {step === 1 && (
          <div className="space-y-4">
            <div className="admission-standard-fields">
              <Check size={17} />
              <span>
                Data diri sudah tersedia: nama, email, WhatsApp, kota, jenis
                kelamin, dan tanggal lahir.
              </span>
            </div>
            <div className="program-section-heading">
              <h3>
                Pertanyaan tambahan{" "}
                <span className="text-muted-foreground">
                  ({draft.fields.length})
                </span>
              </h3>
              <Button
                variant="outline"
                size="sm"
                disabled={draft.fields.length >= 100}
                onClick={newQuestion}
              >
                <Plus size={15} />
                Tambah pertanyaan
              </Button>
            </div>
            {draft.fields.length === 0 ? (
              <div className="admission-empty">
                <p>Tambahkan pertanyaan jika dibutuhkan.</p>
              </div>
            ) : (
              draft.fields.map((field, index) => (
                <article
                  className="admission-question-card"
                  key={field.field_key}
                >
                  <header>
                    <strong>Pertanyaan {index + 1}</strong>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={index === 0}
                        onClick={() => moveField(index, -1)}
                        aria-label={`Naikkan pertanyaan ${index + 1}`}
                      >
                        <ArrowUp size={15} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={index === draft.fields.length - 1}
                        onClick={() => moveField(index, 1)}
                        aria-label={`Turunkan pertanyaan ${index + 1}`}
                      >
                        <ArrowDown size={15} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setRemoveQuestion(index)}
                        aria-label={`Hapus pertanyaan ${index + 1}`}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </header>
                  <div className="admission-form-grid-fields">
                    <label>
                      Pertanyaan
                      <Input
                        value={field.label}
                        onChange={(event) =>
                          changeField(index, { label: event.target.value })
                        }
                        placeholder="Contoh: Tujuan mengikuti program"
                      />
                    </label>
                    <label>
                      Jenis jawaban
                      <select
                        className="field-control"
                        value={field.field_type}
                        onChange={(event) =>
                          changeField(index, {
                            field_type: event.target
                              .value as AdmissionField["field_type"],
                            options_json:
                              event.target.value === "select" ? ["", ""] : null,
                          })
                        }
                      >
                        {Object.entries({
                          text: "Teks singkat",
                          textarea: "Teks panjang",
                          email: "Email",
                          phone: "Telepon",
                          select: "Pilihan",
                          file: "Dokumen / gambar",
                        }).map(([value, label]) => (
                          <option value={value} key={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {field.field_type === "select" && (
                      <label className="admission-field-wide">
                        Pilihan jawaban (satu per baris)
                        <textarea
                          className="field-control min-h-24"
                          value={(field.options_json ?? []).join("\n")}
                          onChange={(event) =>
                            changeField(index, {
                              options_json: event.target.value.split("\n"),
                            })
                          }
                        />
                      </label>
                    )}
                    <label className="admission-checkbox">
                      <input
                        type="checkbox"
                        checked={field.is_required}
                        onChange={(event) =>
                          changeField(index, {
                            is_required: event.target.checked,
                          })
                        }
                      />
                      Wajib dijawab
                    </label>
                  </div>
                </article>
              ))
            )}
            {removeQuestion !== null && (
              <div className="admission-remove-confirm" role="alert">
                <p>
                  Hapus pertanyaan {removeQuestion + 1} dari draf? Jawaban
                  pendaftaran lama tetap tersimpan.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRemoveQuestion(null)}
                >
                  Batal
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    change({
                      fields: draft.fields.filter(
                        (_, index) => index !== removeQuestion,
                      ),
                    });
                    setRemoveQuestion(null);
                  }}
                >
                  Hapus dari draf
                </Button>
              </div>
            )}
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <div className="admission-form-grid-fields">
              <label>
                Platform grup
                <select
                  className="field-control"
                  value={groups.platform}
                  onChange={(event) =>
                    groupChange({
                      platform: event.target.value as GroupSettings["platform"],
                    })
                  }
                >
                  <option value="none">Tanpa grup</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="telegram">Telegram</option>
                </select>
              </label>
              {groups.platform !== "none" && (
                <label className="admission-checkbox">
                  <input
                    type="checkbox"
                    checked={groups.separated_gender}
                    onChange={(event) =>
                      groupChange({ separated_gender: event.target.checked })
                    }
                  />
                  Pisahkan ikhwan dan akhwat
                </label>
              )}
            </div>
            {claimsError && (
              <p className="program-notice">
                Riwayat pemakaian belum tersedia. Tautan lama dikunci sementara.
              </p>
            )}
            {groups.platform !== "none" &&
              activeBuckets.map((bucket) => {
                const lastClaimed = Math.max(
                  -1,
                  ...claims
                    .filter((claim) => claim.group_bucket === bucket)
                    .map((claim) => claim.group_index),
                );
                return (
                  <section className="space-y-3" key={bucket}>
                    <div className="program-section-heading">
                      <h3>
                        {
                          {
                            general_groups: "Grup umum",
                            ikhwan_groups: "Grup ikhwan",
                            akhwat_groups: "Grup akhwat",
                          }[bucket]
                        }
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          groupChange({
                            [bucket]: [
                              ...groups[bucket],
                              { name: "", link: "", click_limit: 500 },
                            ],
                          })
                        }
                      >
                        <Plus size={14} />
                        Tambah tautan
                      </Button>
                    </div>
                    {!groups[bucket].length && (
                      <p className="text-sm text-muted-foreground">
                        Belum ada tautan grup.
                      </p>
                    )}
                    {groups[bucket].map((group, index) => {
                      const used = claims.filter(
                        (claim) =>
                          claim.group_bucket === bucket &&
                          claim.group_index === index,
                      ).length;
                      return (
                        <article className="admission-group-card" key={index}>
                          <header>
                            <strong>Tautan {index + 1}</strong>
                            <span>
                              {claimsError ? "—" : used} /{" "}
                              {group.click_limit ? group.click_limit : "∞"}{" "}
                              pemakaian
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={index <= lastClaimed || claimsError}
                              aria-label={`Hapus tautan ${{ general_groups: "grup umum", ikhwan_groups: "grup ikhwan", akhwat_groups: "grup akhwat" }[bucket]} ${index + 1}`}
                              onClick={() =>
                                groupChange({
                                  [bucket]: groups[bucket].filter(
                                    (_, i) => i !== index,
                                  ),
                                })
                              }
                            >
                              <Trash2 size={15} />
                            </Button>
                          </header>
                          <div className="admission-form-grid-fields">
                            <label>
                              Nama grup
                              <Input
                                value={group.name}
                                onChange={(event) =>
                                  changeGroup(bucket, index, {
                                    name: event.target.value,
                                  })
                                }
                              />
                            </label>
                            <label>
                              Batas pemakaian
                              <Input
                                type="number"
                                min={0}
                                max={999999999}
                                value={group.click_limit ?? 500}
                                onChange={(event) =>
                                  changeGroup(bucket, index, {
                                    click_limit:
                                      event.target.value === ""
                                        ? 0
                                        : Number(event.target.value),
                                  })
                                }
                              />
                            </label>
                            <label className="admission-field-wide">
                              Tautan undangan
                              <Input
                                type="url"
                                value={group.link}
                                disabled={used > 0 || claimsError}
                                onChange={(event) =>
                                  changeGroup(bucket, index, {
                                    link: event.target.value,
                                  })
                                }
                                placeholder="https://…"
                              />
                            </label>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {used
                              ? "Tautan sudah dipakai. Tambahkan tautan baru untuk pengganti."
                              : "0 = tanpa batas. Tautan berikutnya dipakai setelah batas tercapai."}
                          </p>
                        </article>
                      );
                    })}
                  </section>
                );
              })}
            {groups.platform === "none" && (
              <p className="admission-empty">
                Undangan grup tidak ditampilkan kepada pendaftar.
              </p>
            )}
          </div>
        )}
        {discardConfirm && (
          <div className="admission-remove-confirm" role="alert">
            <p>Buang draf lokal dan muat pengaturan dari server?</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDiscardConfirm(false)}
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setDiscardConfirm(false);
                resetDraft();
              }}
            >
              Buang draf lokal
            </Button>
          </div>
        )}
        {step === 3 && (
          <div className="admission-form-review">
            <section className="program-review">
              <h3>{draft.title}</h3>
              <dl>
                <div>
                  <dt>Mode</dt>
                  <dd>
                    {draft.direct ? "Daftar langsung" : "Formulir & review"}
                  </dd>
                </div>
                <div>
                  <dt>Status formulir</dt>
                  <dd>
                    {draft.direct
                      ? "Draf"
                      : { draft: "Draf", active: "Aktif", archived: "Arsip" }[
                          draft.status
                        ]}
                  </dd>
                </div>
                <div>
                  <dt>Periode</dt>
                  <dd>
                    {draft.registration_open_at
                      ? new Date(draft.registration_open_at).toLocaleString(
                          "id-ID",
                        )
                      : "Tanpa batas awal"}{" "}
                    →{" "}
                    {draft.registration_close_at
                      ? new Date(draft.registration_close_at).toLocaleString(
                          "id-ID",
                        )
                      : "Tanpa batas akhir"}
                  </dd>
                </div>
                <div>
                  <dt>Pertanyaan</dt>
                  <dd>{draft.fields.length} tambahan</dd>
                </div>
                <div>
                  <dt>Grup</dt>
                  <dd>
                    {groups.platform === "none"
                      ? "Tanpa grup"
                      : groups.platform}
                  </dd>
                </div>
              </dl>
            </section>
            {draft.fields.length > 0 && (
              <details className="program-disclosure">
                <summary>Lihat pertanyaan</summary>
                <ol className="p-4 space-y-3">
                  {draft.fields.map((field, index) => (
                    <li key={field.field_key}>
                      <strong className="text-sm">
                        {index + 1}. {field.label || "Belum diberi judul"}
                        {field.is_required ? " *" : ""}
                      </strong>
                      {field.field_type === "select" && (
                        <p className="text-sm text-muted-foreground">
                          {field.options_json?.join(" · ")}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </div>
        )}
        <div className="wizard-footer">
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={step === 0}
              onClick={() => {
                setStep((value) => value - 1);
                setError("");
                setRemoveQuestion(null);
              }}
            >
              Kembali
            </Button>
            {dirty && (
              <Button
                variant="ghost"
                onClick={() => {
                  setRemoveQuestion(null);
                  setMessage("");
                  setError("");
                  setDiscardConfirm(true);
                }}
              >
                Buang draf
              </Button>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {step + 1} / {steps.length}
          </span>
          <Button
            disabled={step === 3 && !dirty && !!draft.id}
            onClick={() => {
              setRemoveQuestion(null);
              if (step < 3) {
                setStep((value) => value + 1);
                setError("");
              } else void save();
            }}
          >
            {busy
              ? "Menyimpan…"
              : step === 3
                ? dirty || !draft.id
                  ? "Simpan pengaturan"
                  : "Tersimpan"
                : "Lanjut"}
          </Button>
        </div>
      </fieldset>
    </section>
  );
}
