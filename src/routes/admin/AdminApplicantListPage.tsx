import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  applicantStatusLabels,
  type Applicant,
  type ApplicantAnswer,
  type ApplicantProgramChoice,
  type ApplicantStatus,
} from "../../lib/admission";
import type { Batch, ClassGroup, Halaqah } from "../../lib/enrollment";
import { supabase } from "../../lib/supabase";

type ApplicantListRow = ApplicantProgramChoice & {
  applicants: Applicant;
};

const reviewActions: Array<{
  status: ApplicantStatus;
  label: string;
  variant?: "default" | "outline" | "secondary";
}> = [
  { status: "under_review", label: "Mulai Review", variant: "outline" },
  { status: "revision_requested", label: "Minta Revisi", variant: "secondary" },
  { status: "rejected", label: "Reject", variant: "outline" },
];

export function AdminApplicantListPage() {
  const [rows, setRows] = useState<ApplicantListRow[]>([]);
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<ApplicantAnswer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [halaqahs, setHalaqahs] = useState<Halaqah[]>([]);
  const [assignment, setAssignment] = useState({
    batch_id: "",
    class_id: "",
    halaqah_id: "",
  });

  const selectedRow = useMemo(
    () => rows.find((row) => row.applicant_id === selectedApplicantId) ?? null,
    [rows, selectedApplicantId],
  );

  const loadApplicants = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const { data, error } = await supabase
      .from("applicant_program_choices")
      .select(
        "id, applicant_id, program_id, preferred_schedule, notes, applicants(id, full_name, email, phone, city, gender, birth_date, source_channel, status, submitted_at, created_at), programs(id, code, name, status)",
      )
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
    } else {
      setRows((data ?? []) as unknown as ApplicantListRow[]);
    }

    setIsLoading(false);
  };

  const loadAnswers = async (applicantId: string) => {
    setIsDetailLoading(true);
    setAnswers([]);

    const { data, error } = await supabase
      .from("applicant_answers")
      .select("id, applicant_id, form_field_key, value_text, value_json")
      .eq("applicant_id", applicantId)
      .order("created_at");

    if (error) {
      setErrorMessage(error.message);
    } else {
      setAnswers((data ?? []) as ApplicantAnswer[]);
    }

    setIsDetailLoading(false);
  };

  const loadPlacementOptions = async (programId: string) => {
    const [{ data: batchRows }, { data: classRows }] = await Promise.all([
      supabase
        .from("batches")
        .select("id, program_id, code, name, status")
        .eq("program_id", programId)
        .order("name"),
      supabase
        .from("classes")
        .select("id, program_id, batch_id, code, name, status")
        .eq("program_id", programId)
        .order("name"),
    ]);

    setBatches((batchRows ?? []) as Batch[]);
    setClasses((classRows ?? []) as ClassGroup[]);
    setHalaqahs([]);
    setAssignment({ batch_id: "", class_id: "", halaqah_id: "" });
  };

  const loadHalaqahs = async (classId: string) => {
    if (!classId) {
      setHalaqahs([]);
      return;
    }

    const { data } = await supabase
      .from("halaqahs")
      .select("id, class_id, code, name, status")
      .eq("class_id", classId)
      .order("name");

    setHalaqahs((data ?? []) as Halaqah[]);
  };

  useEffect(() => {
    void loadApplicants();
  }, []);

  const updateStatus = async (status: ApplicantStatus) => {
    if (!selectedRow) {
      return;
    }

    setIsUpdating(true);
    setErrorMessage(null);
    setMessage(null);

    const { error } = await supabase
      .from("applicants")
      .update({ status })
      .eq("id", selectedRow.applicant_id);

    if (error) {
      setErrorMessage(error.message);
    } else {
      setMessage(`Status pendaftaran berubah menjadi ${applicantStatusLabels[status]}.`);
      await loadApplicants();
    }

    setIsUpdating(false);
  };

  const approveAndEnroll = async () => {
    if (!selectedRow) {
      return;
    }

    setIsUpdating(true);
    setErrorMessage(null);
    setMessage(null);

    const { error } = await supabase.rpc("approve_applicant", {
      target_applicant_id: selectedRow.applicant_id,
      target_program_id: selectedRow.program_id,
      target_batch_id: assignment.batch_id || null,
      target_class_id: assignment.class_id || null,
      target_halaqah_id: assignment.halaqah_id || null,
    });

    if (error) {
      setErrorMessage(error.message);
    } else {
      setMessage("Applicant diterima, participant dan enrollment berhasil dibuat.");
      await loadApplicants();
    }

    setIsUpdating(false);
  };

  return (
    <div className="page-stack">
      <section className="page-hero">
        <Badge>Phase 3</Badge>
        <h2>Pendaftaran</h2>
        <p>
          Review calon peserta, ubah status workflow, dan pastikan peserta belum
          dibuat sebelum pendaftaran disetujui.
        </p>
      </section>

      {errorMessage ? (
        <Alert>
          <AlertTitle>Gagal</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}
      {message ? (
        <Alert>
          <AlertTitle>Berhasil</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="split-panel">
        <Card>
          <CardHeader>
            <CardTitle>Daftar Pendaftar</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Memuat pendaftar...</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada pendaftar untuk program dalam scope Anda.
              </p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nama</th>
                      <th>Program</th>
                      <th>Status</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <span className="font-medium">{row.applicants.full_name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {row.applicants.email}
                          </span>
                        </td>
                        <td>{row.programs?.name ?? "-"}</td>
                        <td>
                          <Badge variant={row.applicants.status === "accepted" ? "default" : "secondary"}>
                            {applicantStatusLabels[row.applicants.status]}
                          </Badge>
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedApplicantId(row.applicant_id);
                              void loadAnswers(row.applicant_id);
                              void loadPlacementOptions(row.program_id);
                            }}
                          >
                            Detail
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="detail-drawer">
          <CardHeader>
            <CardTitle>Detail Pendaftar</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedRow ? (
              <p className="text-sm text-muted-foreground">
                Pilih pendaftar untuk melihat detail dan melakukan review.
              </p>
            ) : (
              <div className="space-y-5">
                <dl className="detail-grid">
                  <div>
                    <dt>Nama</dt>
                    <dd>{selectedRow.applicants.full_name}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{selectedRow.applicants.email}</dd>
                  </div>
                  <div>
                    <dt>WhatsApp</dt>
                    <dd>{selectedRow.applicants.phone}</dd>
                  </div>
                  <div>
                    <dt>Kota</dt>
                    <dd>{selectedRow.applicants.city ?? "-"}</dd>
                  </div>
                  <div>
                    <dt>Program</dt>
                    <dd>{selectedRow.programs?.name ?? "-"}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{applicantStatusLabels[selectedRow.applicants.status]}</dd>
                  </div>
                </dl>

                <div>
                  <h3 className="mb-3 text-sm font-semibold">Jawaban Form</h3>
                  {isDetailLoading ? (
                    <p className="text-sm text-muted-foreground">Memuat jawaban...</p>
                  ) : answers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Belum ada jawaban tambahan.</p>
                  ) : (
                    <div className="space-y-3">
                      {answers.map((answer) => (
                        <div className="rounded-lg border p-3" key={answer.id}>
                          <p className="text-xs font-semibold uppercase text-muted-foreground">
                            {answer.form_field_key}
                          </p>
                          <p className="mt-1 text-sm">{answer.value_text || "-"}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Alert>
                  <AlertTitle>Approval membuat participant</AlertTitle>
                  <AlertDescription>
                    Approve & Enrollment akan membuat participant, nomor induk
                    unik, enrollment aktif, checklist onboarding, dan log welcome.
                  </AlertDescription>
                </Alert>

                <div className="space-y-3 rounded-lg border p-3">
                  <h3 className="text-sm font-semibold">Placement Awal</h3>
                  <label className="grid gap-2 text-sm font-medium">
                    Batch
                    <select
                      className="field-control"
                      onChange={(event) =>
                        setAssignment((current) => ({
                          ...current,
                          batch_id: event.target.value,
                        }))
                      }
                      value={assignment.batch_id}
                    >
                      <option value="">Tanpa batch</option>
                      {batches.map((batch) => (
                        <option key={batch.id} value={batch.id}>
                          {batch.code} — {batch.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Kelas
                    <select
                      className="field-control"
                      onChange={(event) => {
                        setAssignment((current) => ({
                          ...current,
                          class_id: event.target.value,
                          halaqah_id: "",
                        }));
                        void loadHalaqahs(event.target.value);
                      }}
                      value={assignment.class_id}
                    >
                      <option value="">Tanpa kelas</option>
                      {classes.map((classGroup) => (
                        <option key={classGroup.id} value={classGroup.id}>
                          {classGroup.code} — {classGroup.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Halaqah
                    <select
                      className="field-control"
                      onChange={(event) =>
                        setAssignment((current) => ({
                          ...current,
                          halaqah_id: event.target.value,
                        }))
                      }
                      value={assignment.halaqah_id}
                    >
                      <option value="">Tanpa halaqah</option>
                      {halaqahs.map((halaqah) => (
                        <option key={halaqah.id} value={halaqah.id}>
                          {halaqah.code} — {halaqah.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={isUpdating || selectedRow.applicants.status === "accepted"}
                    onClick={() => void approveAndEnroll()}
                    size="sm"
                  >
                    Approve & Enrollment
                  </Button>
                  {reviewActions.map((action) => (
                    <Button
                      disabled={isUpdating}
                      key={action.status}
                      onClick={() => void updateStatus(action.status)}
                      size="sm"
                      variant={action.variant}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
