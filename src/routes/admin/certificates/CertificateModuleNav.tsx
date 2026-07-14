import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Award, CheckCircle2, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type CertificateSection = "templates" | "eligibility" | "queue";

const navItems: Array<{
  key: CertificateSection;
  label: string;
  description: string;
  path: string;
  icon: typeof Award;
}> = [
  {
    key: "templates",
    label: "Template",
    description: "Desain & koordinat syahadah",
    path: "sertifikat",
    icon: Award,
  },
  {
    key: "eligibility",
    label: "Kelayakan",
    description: "Validasi peserta siap terbit",
    path: "sertifikat/kelayakan",
    icon: CheckCircle2,
  },
  {
    key: "queue",
    label: "Antrean",
    description: "Pantau proses penerbitan",
    path: "sertifikat/antrean",
    icon: ListChecks,
  },
];

export function CertificateModuleHeader({
  active,
  title,
  description,
  actions,
}: {
  active: CertificateSection;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  const location = useLocation();
  const basePrefix = location.pathname.startsWith("/system") ? "/system" : "/admin";

  return (
    <>
      <section className="page-hero">
        <Badge className="relative z-10 bg-white/15 text-white hover:bg-white/20">Modul Syahadah</Badge>
        <div className="relative z-10 mt-4 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
        </div>
      </section>

      <Card>
        <CardContent className="grid gap-3 p-3 md:grid-cols-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.key;
            return (
              <Button
                key={item.key}
                asChild
                variant={isActive ? "default" : "ghost"}
                className={`h-auto min-h-16 w-full justify-start gap-3 rounded-lg px-4 py-3 text-left ${
                  isActive ? "shadow-sm" : "hover:bg-muted"
                }`}
              >
                <Link to={`${basePrefix}/${item.path}`}>
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block font-semibold">{item.label}</span>
                    <span className={`block truncate text-xs ${isActive ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                      {item.description}
                    </span>
                  </span>
                </Link>
              </Button>
            );
          })}
        </CardContent>
      </Card>
    </>
  );
}
