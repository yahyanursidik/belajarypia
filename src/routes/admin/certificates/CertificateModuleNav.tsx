import type { ReactNode } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Award, CheckCircle2, ListChecks } from "lucide-react";
import { PageHeader } from "../../../components/admin/PageHeader";
import {
  certificatePath,
  certificateStatus,
} from "../../../lib/certificateWorkspace";
export function CertificateModuleHeader({
  active,
  title,
  actions,
}: {
  active: "templates" | "eligibility" | "queue";
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  const location = useLocation();
  const [params] = useSearchParams();
  const base = location.pathname.startsWith("/system") ? "/system" : "/admin";
  return (
    <>
      <PageHeader title={title} actions={actions} />
      <nav className="admin-section-nav" aria-label="Navigasi sertifikat">
        {[
          { key: "templates", path: "", label: "Template", icon: Award },
          {
            key: "eligibility",
            path: "kelayakan",
            label: "Kelayakan",
            icon: CheckCircle2,
          },
          {
            key: "queue",
            path: "antrean",
            label: "Antrean & dokumen",
            icon: ListChecks,
          },
        ].map(({ key, path, label, icon: Icon }) => (
          <Link
            key={key}
            aria-current={active === key ? "page" : undefined}
            to={certificatePath(
              base,
              path,
              params.get("program"),
              params.get("batch"),
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
export function CertificateBadge({ status }: { status: string }) {
  const meta = certificateStatus[status] ?? { label: status, tone: "slate" };
  return (
    <span className={`admission-badge admission-tone-${meta.tone}`}>
      {meta.label}
    </span>
  );
}
