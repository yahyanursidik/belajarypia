import { Link } from "react-router-dom";
import { useAuthSession } from "../../app/providers/authSessionContext";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Circle,
  ClipboardList,
  Edit2,
  FileText,
  Users,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Progress } from "../../components/ui/progress";
import type { Program } from "../../lib/organization";
import {
  programModelLabel,
  programSetupItems,
  type ProgramSection,
  type ProgramSetupSummary,
} from "../../lib/programWorkspace";

export function ProgramDetailSection({
  program,
  summary,
  onNavigate,
  onSettings,
}: {
  program: Program;
  summary: ProgramSetupSummary;
  onNavigate: (section: ProgramSection) => void;
  onSettings?: () => void;
}) {
  const { primaryRole } = useAuthSession();
  const items = programSetupItems(program, summary).filter(
    (item) => onSettings || item.key !== "profile",
  );
  const done = items.filter((item) => item.done).length;
  const next = items.find((item) => !item.done);
  const metrics = [
    {
      label: "Materi terbit",
      value: summary.publishedLessons,
      icon: BookOpenCheck,
      tone: "emerald",
      section: "kurikulum" as const,
    },
    {
      label: "Kuis & ujian",
      value: summary.quizLessons,
      icon: FileText,
      tone: "amber",
      section: "kurikulum" as const,
    },
    {
      label: "Enrollment aktif",
      value: summary.participants,
      icon: Users,
      tone: "blue",
      section: "peserta" as const,
    },
    program.curriculum_model === "angkatan"
      ? {
          label: "Kelas",
          value: summary.classes,
          icon: CalendarDays,
          tone: "violet",
          section: "angkatan-kelas" as const,
        }
      : {
          label: "Mata pelajaran",
          value: summary.modules,
          icon: BookOpenCheck,
          tone: "violet",
          section: "kurikulum" as const,
        },
  ];
  return (
    <div className="program-overview">
      <div className="program-metrics">
        {metrics.map(({ label, value, icon: Icon, tone, section }) => (
          <button
            key={label}
            className={`admin-stat admin-tone-${tone}`}
            onClick={() => onNavigate(section)}
          >
            <span className="admin-stat__icon">
              <Icon size={19} />
            </span>
            <span>
              <span className="admin-stat__label">{label}</span>
              <strong>{value}</strong>
            </span>
            <ArrowRight size={15} />
          </button>
        ))}
      </div>
      <div className="program-overview-grid">
        <section className="program-panel program-readiness">
          <header>
            <div>
              <h2>Siapkan program</h2>
              <p>
                {done} dari {items.length} pengaturan lengkap
              </p>
            </div>
            <span className="program-readiness__fraction">
              {Math.round((done / items.length) * 100)}%
            </span>
          </header>
          <Progress
            aria-label="Kelengkapan pengaturan program"
            value={(done / items.length) * 100}
          />
          <div className="program-setup-checklist">
            {items.map((item) => (
              <button
                key={item.key}
                onClick={() =>
                  item.key === "profile"
                    ? onSettings?.()
                    : onNavigate(item.section)
                }
              >
                {item.done ? (
                  <CheckCircle2 size={18} className="text-emerald-600" />
                ) : (
                  <Circle size={18} className="text-amber-500" />
                )}
                <span>{item.label}</span>
                <span>
                  {item.done ? "Lengkap" : "Lengkapi"} <ArrowRight size={13} />
                </span>
              </button>
            ))}
          </div>
          <Button
            onClick={() =>
              next?.key === "profile"
                ? onSettings?.()
                : onNavigate(next?.section ?? "peserta")
            }
          >
            {next ? `Lanjutkan: ${next.label.toLowerCase()}` : "Kelola peserta"}
            <ArrowRight size={15} />
          </Button>
        </section>
        <section className="program-panel">
          <header>
            <h2>Profil & pengaturan</h2>
            {onSettings && (
              <Button size="sm" variant="outline" onClick={onSettings}>
                <Edit2 size={14} />
                Ubah
              </Button>
            )}
          </header>
          <p className="program-profile-description">
            {program.description || "Tambahkan deskripsi singkat program."}
          </p>
          <dl className="program-profile-facts">
            {[
              ["Kode", program.code],
              ["Unit", program.units?.name ?? "Unit program"],
              ["Model belajar", programModelLabel(program.curriculum_model)],
              [
                "Pertemuan",
                (
                  {
                    online: "Daring",
                    offline: "Tatap muka",
                    hybrid: "Gabungan",
                  } as Record<string, string>
                )[program.delivery_mode] ?? program.delivery_mode,
              ],
              [
                "Pendaftaran",
                program.feature_flags.use_direct_enrollment
                  ? "Langsung"
                  : "Formulir",
              ],
              [
                "Biaya",
                program.feature_flags.payment_type === "spp" ? "Bulanan" : program.feature_flags.use_payment ? "Biaya kelas" : "Gratis",
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="program-overview-links">
            {onSettings && (
              <>
                <button onClick={() => onNavigate("pendaftaran")}>
                  <ClipboardList size={16} />
                  Atur pendaftaran
                  <ArrowRight size={14} />
                </button>
                <button onClick={() => onNavigate("report")}>
                  <FileText size={16} />
                  Lihat laporan belajar
                  <ArrowRight size={14} />
                </button>
              </>
            )}
            {(primaryRole === "super_admin" || primaryRole === "admin") && <Link to={`${primaryRole === "super_admin" ? "/system" : "/admin"}/helpdesk?program=${program.id}&contextProgram=${program.id}&category=academic`}>Tiket bantuan program<ArrowRight size={14}/></Link>}
            {program.status === "active" && (
              <a
                href={`/katalog/${program.id}`}
                target="_blank"
                rel="noreferrer"
              >
                Lihat katalog publik
                <ArrowRight size={14} />
              </a>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
