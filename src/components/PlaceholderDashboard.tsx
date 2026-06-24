import { Info, LayoutDashboard, Activity } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

type DashboardMetric = {
  label: string;
  value: string | number;
};

type PlaceholderDashboardProps = {
  role: string;
  title: string;
  description: string;
  metrics: DashboardMetric[];
  nextItems: string[];
};

export function PlaceholderDashboard({
  role,
  title,
  description,
  metrics,
  nextItems,
}: PlaceholderDashboardProps) {
  return (
    <div className="page-stack">
      <section className="page-hero">
        <Badge variant="secondary" className="mb-4 bg-white/20 hover:bg-white/30 text-white border-white/10 backdrop-blur-sm">Phase 0</Badge>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex h-16 w-16 rounded-2xl bg-white/10 backdrop-blur-md items-center justify-center border border-white/20">
            <LayoutDashboard className="h-8 w-8 text-white" />
          </div>
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
        </div>
      </section>

      <div className="metric-grid">
        {metrics.map((metric) => (
          <Card key={metric.label} className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.label}
              </CardTitle>
              <Activity className="h-4 w-4 text-primary opacity-70" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{metric.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Alert className="flex gap-3">
        <Info className="mt-0.5 h-4 w-4 text-primary" />
        <div>
          <AlertTitle>{`Dashboard ${role} masih placeholder`}</AlertTitle>
          <AlertDescription>
            Data asli, autentikasi berbasis role, dan resource operasional akan
            ditambahkan pada fase berikutnya.
          </AlertDescription>
        </div>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Arah Implementasi Berikutnya</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="clean-list">
            {nextItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <EmptyState
      title={title}
      description={`${title} belum diimplementasikan pada Phase 0.`}
    />
  );
}
