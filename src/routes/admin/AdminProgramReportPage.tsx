import { useEffect, useState } from "react";
import {
  Link,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import Papa from "papaparse";
import { ClipboardCheck, Download, RefreshCw, Search } from "lucide-react";
import { PageHeader } from "../../components/admin/PageHeader";
import { ProgramNavigation } from "../../components/programs/ProgramNavigation";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Progress } from "../../components/ui/progress";
import {
  programDirectoryPath,
  programSectionPath,
} from "../../lib/programWorkspace";
import {
  summarizeProgramLearning,
  type ReportProgress,
  type ReportLesson,
} from "../../lib/programLearningReport";
import type { Program } from "../../lib/organization";
import { supabase } from "../../lib/supabase";

type EnrollmentReport = {
  id: string;
  participant_id: string;
  enrollment_number: string;
  participants: {
    display_name: string;
    global_participant_number: string;
    profiles: { email: string | null } | null;
  };
};
type Row = EnrollmentReport & {
  percent: number;
  completed: number;
  total: number;
  averageScore: number | null;
  predicate: string;
};
export function AdminProgramReportPage() {
  const { programId } = useParams();
  const location = useLocation();
  const [params] = useSearchParams();
  const basePath = location.pathname.startsWith("/system")
    ? "/system"
    : "/admin";
  const returnTo = programDirectoryPath(basePath, params.get("returnTo"));
  const [program, setProgram] = useState<Program | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setRows([]);
    setProgram(null);
    void (async () => {
      try {
        const [programResult, enrollmentResult, lessonResult] =
          await Promise.all([
            supabase
              .from("programs")
              .select("*,units(code,name)")
              .eq("id", programId)
              .abortSignal(controller.signal)
              .single(),
            supabase
              .from("enrollments")
              .select(
                "id,participant_id,enrollment_number,participants!inner(display_name,global_participant_number,profiles(email))",
              )
              .eq("program_id", programId)
              .neq("enrollment_status", "cancelled")
              .order("created_at")
              .abortSignal(controller.signal),
            supabase
              .from("lessons")
              .select(
                "id,lesson_type,visibility_status,program_modules!inner(program_id)",
              )
              .eq("program_modules.program_id", programId)
              .abortSignal(controller.signal),
          ]);
        if (controller.signal.aborted) return;
        if (programResult.error || enrollmentResult.error || lessonResult.error)
          throw new Error("Laporan belum dapat dimuat.");
        const enrollments = (enrollmentResult.data ??
          []) as unknown as EnrollmentReport[];
        const progressRows: Array<ReportProgress & { enrollment_id: string }> =
          [];
        // Fetch in bounded batches so large rosters do not exceed URL/row limits.
        for (let start = 0; start < enrollments.length; start += 100) {
          const ids = enrollments
            .slice(start, start + 100)
            .map((row) => row.id);
          for (let offset = 0; ; offset += 500) {
            const result = await supabase
              .from("lesson_progresses")
              .select("enrollment_id,lesson_id,status,score,updated_at")
              .in("enrollment_id", ids)
              .order("id")
              .range(offset, offset + 499)
              .abortSignal(controller.signal);
            if (controller.signal.aborted) return;
            if (result.error) throw result.error;
            progressRows.push(...((result.data ?? []) as typeof progressRows));
            if ((result.data?.length ?? 0) < 500) break;
          }
        }
        const current = programResult.data as Program;
        setProgram(current);
        setRows(
          enrollments.map((enrollment) => {
            const metrics = summarizeProgramLearning(
              (lessonResult.data ?? []) as ReportLesson[],
              progressRows.filter(
                (progress) => progress.enrollment_id === enrollment.id,
              ),
            );
            return {
              ...enrollment,
              percent: metrics.percent,
              completed: metrics.completed,
              total: metrics.total,
              averageScore: metrics.averageScore,
              predicate:
                metrics.averageScore === null
                  ? "—"
                  : (current.grading_rubric?.find(
                      (item) =>
                        metrics.averageScore! >= item.min_score &&
                        metrics.averageScore! <= item.max_score,
                    )?.label ?? "Belum dipetakan"),
            };
          }),
        );
      } catch {
        if (!controller.signal.aborted)
          setError("Laporan belum dapat dimuat. Coba lagi.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [programId, reload]);
  const filtered = rows.filter(
    (row) =>
      (!search ||
        [
          row.participants.display_name,
          row.participants.global_participant_number,
          row.participants.profiles?.email,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (filter === "all" ||
        (filter === "finished"
          ? row.total > 0 && row.percent === 100
          : row.total === 0 || row.percent < 100)),
  );
  function exportCsv() {
    const data = [
      [
        "Nama",
        "Nomor induk",
        "Enrollment",
        "Materi selesai",
        "Total materi terbit",
        "Progres (%)",
        "Rata-rata evaluasi",
        "Predikat",
      ],
      ...filtered.map((row) => [
        row.participants.display_name,
        row.participants.global_participant_number,
        row.enrollment_number,
        row.completed,
        row.total,
        Math.round(row.percent),
        row.averageScore === null ? "" : row.averageScore.toFixed(1),
        row.predicate,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + Papa.unparse(data, { escapeFormulae: true })], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "laporan-program.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="page-stack program-workspace">
      <nav className="admin-breadcrumb" aria-label="Jejak navigasi">
        <Link to={returnTo}>Program</Link>
        <span>/</span>
        <Link
          to={programSectionPath(
            basePath,
            programId ?? "",
            "detail-program",
            returnTo,
          )}
        >
          {program?.name ?? "Laporan"}
        </Link>
      </nav>
      <PageHeader
        title={program?.name ?? "Laporan program"}
        eyebrow="Laporan belajar"
        actions={
          <>
            <Button
              variant="outline"
              aria-label="Muat ulang laporan"
              onClick={() => setReload((value) => value + 1)}
            >
              <RefreshCw size={16} />
            </Button>
            <Button
              variant="outline"
              disabled={loading || Boolean(error) || !filtered.length}
              onClick={exportCsv}
            >
              <Download size={16} />
              Ekspor hasil
            </Button>
            {program && (
              <Button variant="outline" asChild>
                <Link to={`${basePath}/penilaian?program=${program.id}`}>
                  <ClipboardCheck size={16} />
                  Antrean penilaian
                </Link>
              </Button>
            )}
          </>
        }
      />
      <ProgramNavigation
        basePath={basePath}
        programId={programId ?? ""}
        section="report"
        scheduled={program?.curriculum_model === "angkatan"}
        returnTo={returnTo}
      />
      {error ? (
        <div className="program-panel">
          <p className="program-error" role="alert">
            {error}
          </p>
          <Button onClick={() => setReload((value) => value + 1)}>
            Coba lagi
          </Button>
        </div>
      ) : (
        <section className="program-panel program-report">
          <div className="program-section-heading">
            <h2>Progres peserta</h2>
            <span className="text-xs text-muted-foreground">
              Materi terbit · evaluasi yang sudah dinilai
            </span>
          </div>
          <div className="program-directory-toolbar">
            <label className="program-search">
              <Search size={16} />
              <Input
                aria-label="Cari peserta laporan"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama atau nomor induk…"
              />
            </label>
            <select
              aria-label="Progres peserta"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="all">Semua progres</option>
              <option value="finished">Materi selesai</option>
              <option value="ongoing">Belum selesai</option>
            </select>
          </div>
          {loading ? (
            <p className="program-loading" role="status">
              Memuat laporan…
            </p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Peserta</th>
                    <th>Materi</th>
                    <th>Rata-rata evaluasi</th>
                    <th>Predikat</th>
                    <th>Dokumen</th>
                  </tr>
                </thead>
                <tbody>
                  {!filtered.length ? (
                    <tr>
                      <td colSpan={5}>Tidak ada peserta sesuai filter.</td>
                    </tr>
                  ) : (
                    filtered.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <Link
                            className="font-semibold"
                            to={`${basePath}/peserta/${row.participant_id}?tab=academic`}
                          >
                            {row.participants.display_name}
                          </Link>
                          <small className="block text-muted-foreground">
                            {row.participants.global_participant_number}
                          </small>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={row.percent}
                              aria-label={`Progres ${row.participants.display_name}`}
                              className="w-24"
                            />
                            <span>{Math.round(row.percent)}%</span>
                          </div>
                          <small>
                            {row.completed} / {row.total} materi terbit
                          </small>
                        </td>
                        <td>
                          {row.averageScore === null
                            ? "Belum dinilai"
                            : row.averageScore.toFixed(1)}
                        </td>
                        <td>{row.predicate}</td>
                        <td>
                          <Button variant="outline" size="sm" asChild>
                            <Link
                              to={`${basePath}/peserta/${row.participant_id}/transkrip/${row.id}`}
                            >
                              Transkrip
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
