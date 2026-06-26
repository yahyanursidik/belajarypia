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
import { ProgramAdmissionBuilder } from "./ProgramAdmissionBuilder";

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
  
  const [activeTab, setActiveTab] = useState<"review" | "settings">("review");
  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedProgramIdForSettings, setSelectedProgramIdForSettings] = useState<string | null>(null);

  // Pagination & Filters
  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const pageSize = 10;
  
  const [filterProgram, setFilterProgram] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");

  const selectedRow = useMemo(
    () => rows.find((row) => row.applicant_id === selectedApplicantId) ?? null,
    [rows, selectedApplicantId],
  );

  const loadApplicants = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    let query = supabase
      .from("applicant_program_choices")
      .select(
        "id, applicant_id, program_id, preferred_schedule, notes, applicants!inner(id, full_name, email, phone, city, gender, birth_date, source_channel, status, submitted_at, created_at), programs(id, code, name, status)",
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    if (filterProgram !== "all") {
      query = query.eq("program_id", filterProgram);
    }
    
    if (filterStatus !== "all") {
      query = query.eq("applicants.status", filterStatus);
    }

    if (searchQuery) {
      query = query.or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`, { foreignTable: "applicants" });
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) {
      setErrorMessage(error.message);
    } else {
      setRows((data ?? []) as unknown as ApplicantListRow[]);
      setTotalRows(count ?? 0);
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

  const loadPrograms = async () => {
    const { data } = await supabase.from("programs").select("id, name, code, status").order("created_at", { ascending: false });
    if (data) setPrograms(data);
  };

  useEffect(() => {
    void loadApplicants();
  }, [page, filterProgram, filterStatus, searchQuery]);

  useEffect(() => {
    void loadPrograms();
  }, []);

  const handleSearch = () => {
    setSearchQuery(searchInput);
    setPage(1);
  };

  const exportToCSV = async () => {
    let query = supabase
      .from("applicant_program_choices")
      .select(
        "id, applicant_id, program_id, preferred_schedule, notes, applicants!inner(id, full_name, email, phone, city, gender, birth_date, source_channel, status, submitted_at, created_at), programs(id, code, name, status)"
      )
      .order("created_at", { ascending: false });

    if (filterProgram !== "all") query = query.eq("program_id", filterProgram);
    if (filterStatus !== "all") query = query.eq("applicants.status", filterStatus);
    if (searchQuery) query = query.or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`, { foreignTable: "applicants" });

    const { data, error } = await query;
    if (error) {
      alert("Gagal export CSV: " + error.message);
      return;
    }

    const csvRows = [
      ["Nama", "Email", "No. HP", "Kota", "Program", "Status", "Tanggal Daftar"]
    ];
    for (const row of (data as unknown as ApplicantListRow[])) {
      csvRows.push([
        `"${row.applicants.full_name}"`,
        `"${row.applicants.email}"`,
        `"${row.applicants.phone || ""}"`,
        `"${row.applicants.city || ""}"`,
        `"${row.programs?.name || ""}"`,
        `"${applicantStatusLabels[row.applicants.status] || ""}"`,
        `"${new Date(row.applicants.submitted_at || row.applicants.created_at).toLocaleString('id-ID')}"`
      ]);
    }
    const csvString = csvRows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Data_Pendaftar_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

      <div className="flex border-b mb-6 overflow-x-auto hide-scrollbar">
        <button className={`px-6 py-3 font-semibold text-sm whitespace-nowrap transition-colors ${activeTab === "review" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setActiveTab("review")}>
          Review Pendaftar
        </button>
        <button className={`px-6 py-3 font-semibold text-sm whitespace-nowrap transition-colors ${activeTab === "settings" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setActiveTab("settings")}>
          Pengaturan Form Pendaftaran
        </button>
      </div>

      {activeTab === "review" && (
        <div className="space-y-6">
          <Card className="border-indigo-100 shadow-sm bg-slate-50/50">
            <CardContent className="p-4 flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Cari Pendaftar</label>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    placeholder="Nama atau email..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="field-control flex-1 text-sm"
                  />
                  <Button size="sm" onClick={handleSearch}>Cari</Button>
                </div>
              </div>
              <div className="w-full sm:w-[200px]">
                <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Filter Program</label>
                <select 
                  className="field-control text-sm w-full"
                  value={filterProgram}
                  onChange={(e) => { setFilterProgram(e.target.value); setPage(1); }}
                >
                  <option value="all">Semua Program</option>
                  {programs.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
                </select>
              </div>
              <div className="w-full sm:w-[200px]">
                <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Filter Status</label>
                <select 
                  className="field-control text-sm w-full"
                  value={filterStatus}
                  onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                >
                  <option value="all">Semua Status</option>
                  {Object.entries(applicantStatusLabels).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <Button size="sm" variant="outline" onClick={exportToCSV} className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200">
                Export CSV
              </Button>
            </CardContent>
          </Card>

          <div className="split-panel">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Daftar Pendaftar <span className="text-sm font-normal text-muted-foreground ml-2">({totalRows} total)</span></CardTitle>
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
            {totalRows > pageSize && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <span className="text-sm text-muted-foreground">
                  Menampilkan {Math.min((page - 1) * pageSize + 1, totalRows)} - {Math.min(page * pageSize, totalRows)} dari {totalRows}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Sebelumnya</Button>
                  <Button size="sm" variant="outline" onClick={() => setPage(p => p + 1)} disabled={page * pageSize >= totalRows}>Selanjutnya</Button>
                </div>
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
                      {answers.map((answer) => {
                        const isFile = answer.value_text?.startsWith("applicants/");
                        const publicUrl = isFile ? supabase.storage.from("admission_documents").getPublicUrl(answer.value_text!).data.publicUrl : "";
                        
                        return (
                          <div className="rounded-lg border p-3" key={answer.id}>
                            <p className="text-xs font-semibold uppercase text-muted-foreground">
                              {answer.form_field_key}
                            </p>
                            {isFile ? (
                              <a href={publicUrl} target="_blank" rel="noreferrer" className="mt-1 text-sm text-indigo-600 hover:underline flex items-center gap-1">
                                📎 Unduh File Lampiran
                              </a>
                            ) : (
                              <p className="mt-1 text-sm">{answer.value_text || "-"}</p>
                            )}
                          </div>
                        );
                      })}
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
      )}

      {activeTab === "settings" && (
        <Card className="max-w-4xl mx-auto w-full border-none shadow-none bg-transparent">
          <CardHeader className="px-0">
            <CardTitle>Pilih Program</CardTitle>
            <p className="text-sm text-muted-foreground">Pilih program yang ingin diatur form pendaftarannya.</p>
          </CardHeader>
          <CardContent className="px-0">
            <select
              className="field-control w-full mb-6 text-sm"
              value={selectedProgramIdForSettings || ""}
              onChange={(e) => setSelectedProgramIdForSettings(e.target.value)}
            >
              <option value="">-- Pilih Program --</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>{p.code} - {p.name} {p.status === 'active' ? '' : `(${p.status})`}</option>
              ))}
            </select>
            
            {selectedProgramIdForSettings ? (
              <ProgramAdmissionBuilder programId={selectedProgramIdForSettings} />
            ) : (
              <div className="text-center p-12 text-muted-foreground border-2 border-dashed border-slate-200 rounded-lg bg-white">
                Silakan pilih program terlebih dahulu.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
