import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "../../lib/supabase";
import type { Organization, Unit } from "../../lib/organization";

export function UnitGovernancePage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [organizationName, setOrganizationName] = useState("");
  const [unitForm, setUnitForm] = useState({
    organization_id: "",
    code: "",
    name: "",
    description: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const [{ data: orgRows, error: orgError }, { data: unitRows, error: unitError }] =
      await Promise.all([
        supabase.from("organizations").select("id, name, legal_name, status").order("name"),
        supabase
          .from("units")
          .select("id, organization_id, code, name, description, status, organizations(name)")
          .order("name"),
      ]);

    if (orgError || unitError) {
      setErrorMessage(orgError?.message ?? unitError?.message ?? "Gagal memuat data.");
    } else {
      setOrganizations((orgRows ?? []) as Organization[]);
      setUnits((unitRows ?? []) as unknown as Unit[]);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  return (
    <div className="page-stack">
      <section className="page-hero">
        <Badge>Phase 2</Badge>
        <h2>Unit Governance</h2>
        <p>
          Kelola struktur yayasan dan unit. Halaman ini khusus Super Admin untuk
          menyiapkan ruang kerja admin program.
        </p>
      </section>

      {errorMessage ? (
        <Alert>
          <AlertTitle>Gagal memuat data</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}
      {message ? (
        <Alert>
          <AlertTitle>Berhasil</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="feature-grid">
        <Card>
          <CardHeader>
            <CardTitle>Buat Organisasi</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                setIsSubmitting(true);
                setErrorMessage(null);
                setMessage(null);

                const { error } = await supabase
                  .from("organizations")
                  .insert({ name: organizationName.trim() });

                if (error) {
                  setErrorMessage(error.message);
                } else {
                  setOrganizationName("");
                  setMessage("Organisasi berhasil dibuat.");
                  await loadData();
                }

                setIsSubmitting(false);
              }}
            >
              <label className="grid gap-2 text-sm font-medium">
                Nama organisasi
                <Input
                  onChange={(event) => setOrganizationName(event.target.value)}
                  placeholder="Yayasan Pendidikan Ihsanul Adab"
                  required
                  value={organizationName}
                />
              </label>
              <Button disabled={isSubmitting} type="submit">
                Buat Organisasi
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Buat Unit</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 md:grid-cols-2"
              onSubmit={async (event) => {
                event.preventDefault();
                setIsSubmitting(true);
                setErrorMessage(null);
                setMessage(null);

                const { error } = await supabase.from("units").insert({
                  organization_id: unitForm.organization_id,
                  code: unitForm.code.trim(),
                  name: unitForm.name.trim(),
                  description: unitForm.description.trim() || null,
                });

                if (error) {
                  setErrorMessage(error.message);
                } else {
                  setUnitForm({
                    organization_id: "",
                    code: "",
                    name: "",
                    description: "",
                  });
                  setMessage("Unit berhasil dibuat.");
                  await loadData();
                }

                setIsSubmitting(false);
              }}
            >
              <label className="grid gap-2 text-sm font-medium">
                Organisasi
                <select
                  className="field-control"
                  onChange={(event) =>
                    setUnitForm((current) => ({
                      ...current,
                      organization_id: event.target.value,
                    }))
                  }
                  required
                  value={unitForm.organization_id}
                >
                  <option value="">Pilih organisasi</option>
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Kode unit
                <Input
                  onChange={(event) =>
                    setUnitForm((current) => ({ ...current, code: event.target.value }))
                  }
                  placeholder="YPIA-QURAN"
                  required
                  value={unitForm.code}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Nama unit
                <Input
                  onChange={(event) =>
                    setUnitForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Unit Qur'an"
                  required
                  value={unitForm.name}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Deskripsi
                <Input
                  onChange={(event) =>
                    setUnitForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Keterangan singkat"
                  value={unitForm.description}
                />
              </label>
              <div className="md:col-span-2">
                <Button disabled={isSubmitting || organizations.length === 0} type="submit">
                  Buat Unit
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Unit</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Memuat unit...</p>
          ) : units.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada unit.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Nama Unit</th>
                    <th>Organisasi</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((unit) => (
                    <tr key={unit.id}>
                      <td>{unit.code}</td>
                      <td>{unit.name}</td>
                      <td>{unit.organizations?.name ?? "-"}</td>
                      <td>
                        <Badge variant="secondary">{unit.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
