import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Archive, Award, CheckCircle2, Edit2, FileJson, Image, Plus, RefreshCw, Search, Trash, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "../../../lib/supabase";
import { CertificateModuleHeader } from "./CertificateModuleNav";

type CertificateTemplateStatus = "active" | "archived";
type CertificateTemplateType = "html" | "json";

type ProgramOption = {
  id: string;
  name: string;
  code?: string | null;
};

type CertificateTemplateRow = {
  id: string;
  program_id: string;
  name: string;
  template_type: CertificateTemplateType;
  template_data_json: Record<string, unknown> | null;
  background_object_key: string | null;
  status: CertificateTemplateStatus;
  created_at: string;
  updated_at: string;
};

type TemplateFormState = {
  program_id: string;
  name: string;
  template_type: CertificateTemplateType;
  status: CertificateTemplateStatus;
  background_object_key: string;
  template_data_json: string;
};

const initialForm: TemplateFormState = {
  program_id: "",
  name: "",
  template_type: "html",
  status: "active",
  background_object_key: "",
  template_data_json: "{\n  \"recipient_name\": { \"x\": 120, \"y\": 260 },\n  \"certificate_number\": { \"x\": 120, \"y\": 420 }\n}",
};

const statusMeta: Record<CertificateTemplateStatus, { label: string; className: string }> = {
  active: { label: "Aktif", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  archived: { label: "Arsip", className: "border-slate-200 bg-slate-100 text-slate-700" },
};

export function CertificateTemplatesPage() {
  const [templates, setTemplates] = useState<CertificateTemplateRow[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProgram, setFilterProgram] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | CertificateTemplateStatus>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateFormState>(initialForm);

  const loadData = useCallback(async (silent = false) => {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    const [{ data: templateRows, error: templateError }, { data: programRows, error: programError }] = await Promise.all([
      supabase
        .from("certificate_templates")
        .select("id, program_id, name, template_type, template_data_json, background_object_key, status, created_at, updated_at")
        .order("updated_at", { ascending: false }),
      supabase.from("programs").select("id, name, code").order("name"),
    ]);

    if (templateError || programError) {
      setErrorMessage(templateError?.message ?? programError?.message ?? "Gagal memuat data template.");
    } else {
      setTemplates((templateRows ?? []) as CertificateTemplateRow[]);
      setPrograms((programRows ?? []) as ProgramOption[]);
    }

    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const programMap = useMemo(() => new Map(programs.map((program) => [program.id, program])), [programs]);

  const stats = useMemo(() => ({
    total: templates.length,
    active: templates.filter((template) => template.status === "active").length,
    archived: templates.filter((template) => template.status === "archived").length,
    withBackground: templates.filter((template) => Boolean(template.background_object_key)).length,
    programCount: new Set(templates.map((template) => template.program_id)).size,
  }), [templates]);

  const filteredTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return templates.filter((template) => {
      const program = programMap.get(template.program_id);
      const matchesSearch = !query
        || template.name.toLowerCase().includes(query)
        || template.template_type.toLowerCase().includes(query)
        || (program?.name ?? "").toLowerCase().includes(query);
      const matchesProgram = filterProgram === "all" || template.program_id === filterProgram;
      const matchesStatus = filterStatus === "all" || template.status === filterStatus;
      return matchesSearch && matchesProgram && matchesStatus;
    });
  }, [filterProgram, filterStatus, programMap, searchQuery, templates]);

  const openCreateModal = () => {
    setEditingTemplateId(null);
    setForm({ ...initialForm, program_id: programs[0]?.id ?? "" });
    setIsModalOpen(true);
  };

  const openEditModal = (template: CertificateTemplateRow) => {
    setEditingTemplateId(template.id);
    setForm({
      program_id: template.program_id,
      name: template.name,
      template_type: template.template_type,
      status: template.status,
      background_object_key: template.background_object_key ?? "",
      template_data_json: JSON.stringify(template.template_data_json ?? {}, null, 2),
    });
    setIsModalOpen(true);
  };

  const saveTemplate = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    let parsedJson: Record<string, unknown> | null = null;
    if (form.template_data_json.trim()) {
      try {
        parsedJson = JSON.parse(form.template_data_json) as Record<string, unknown>;
      } catch {
        setErrorMessage("Template data JSON tidak valid. Periksa tanda kurung, koma, dan tanda kutip.");
        setIsSaving(false);
        return;
      }
    }

    const payload = {
      program_id: form.program_id,
      name: form.name.trim(),
      template_type: form.template_type,
      status: form.status,
      background_object_key: form.background_object_key.trim() || null,
      template_data_json: parsedJson,
    };

    const request = editingTemplateId
      ? supabase.from("certificate_templates").update(payload).eq("id", editingTemplateId)
      : supabase.from("certificate_templates").insert(payload);
    const { error } = await request;

    if (error) {
      setErrorMessage(error.message);
    } else {
      setSuccessMessage(`Template berhasil ${editingTemplateId ? "diperbarui" : "dibuat"}.`);
      setIsModalOpen(false);
      await loadData(true);
    }

    setIsSaving(false);
  };

  const archiveTemplate = async (template: CertificateTemplateRow) => {
    const nextStatus = template.status === "active" ? "archived" : "active";
    const { error } = await supabase.from("certificate_templates").update({ status: nextStatus }).eq("id", template.id);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setSuccessMessage(`Template berhasil ${nextStatus === "active" ? "diaktifkan" : "diarsipkan"}.`);
    await loadData(true);
  };

  const deleteTemplate = async (template: CertificateTemplateRow) => {
    if (!window.confirm(`Hapus template "${template.name}"? Template yang sudah dipakai antrean mungkin tidak bisa dihapus.`)) return;
    const { error } = await supabase.from("certificate_templates").delete().eq("id", template.id);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setSuccessMessage("Template berhasil dihapus.");
    await loadData(true);
  };

  return (
    <div className="page-stack pb-12">
      <CertificateModuleHeader
        active="templates"
        title="Template Syahadah"
        description="Kelola desain, koordinat, background, dan status template sebelum dipakai untuk penerbitan syahadah."
        actions={(
          <>
            <Button
              type="button"
              onClick={() => void loadData(true)}
              disabled={isRefreshing}
              variant="outline"
              className="h-10 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Muat Ulang
            </Button>
            <Button onClick={openCreateModal} className="h-10 bg-amber-400 text-slate-950 hover:bg-amber-300">
              <Plus className="h-4 w-4" />
              Tambah Template
            </Button>
          </>
        )}
      />

      {errorMessage && (
        <Alert className="border-red-500 bg-red-50 text-red-900">
          <AlertTitle>Gagal</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      {successMessage && (
        <Alert className="border-emerald-500 bg-emerald-50 text-emerald-900">
          <AlertTitle>Berhasil</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-5">
        <TemplateMetricCard title="Total" value={stats.total} description="template tersedia" icon={Award} />
        <TemplateMetricCard title="Aktif" value={stats.active} description="siap dipakai" icon={CheckCircle2} />
        <TemplateMetricCard title="Arsip" value={stats.archived} description="tidak dipakai" icon={Archive} />
        <TemplateMetricCard title="Background" value={stats.withBackground} description="punya file latar" icon={Image} />
        <TemplateMetricCard title="Program" value={stats.programCount} description="tercakup" icon={FileJson} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workflow Template</CardTitle>
          <CardDescription>Pastikan setiap program punya template aktif sebelum membuat antrean penerbitan.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-3">
          <WorkflowItem
            done={stats.active > 0}
            title="Template aktif tersedia"
            description={`${stats.active} template aktif siap dipakai untuk penerbitan syahadah.`}
            action="Lihat Aktif"
            onClick={() => setFilterStatus("active")}
          />
          <WorkflowItem
            done={stats.withBackground === stats.total || stats.total === 0}
            title="Lengkapi background"
            description={`${stats.total - stats.withBackground} template belum memiliki background object key.`}
            action="Cari Kosong"
            onClick={() => setSearchQuery("html")}
          />
          <WorkflowItem
            done={programs.length === stats.programCount || templates.length === 0}
            title="Cakupan program"
            description={`${stats.programCount} dari ${programs.length} program sudah memiliki template.`}
            action="Semua Program"
            onClick={() => setFilterProgram("all")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Direktori Template</CardTitle>
          <CardDescription>Cari template, filter per program, lalu edit koordinat atau arsipkan template lama.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_auto] xl:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-11 pl-9"
                placeholder="Cari template, tipe, atau program..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <select className="field-control h-11 w-full bg-white sm:w-64" value={filterProgram} onChange={(event) => setFilterProgram(event.target.value)}>
                <option value="all">Semua Program</option>
                {programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
              </select>
              <select className="field-control h-11 w-full bg-white sm:w-40" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as "all" | CertificateTemplateStatus)}>
                <option value="all">Semua Status</option>
                <option value="active">Aktif</option>
                <option value="archived">Arsip</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed bg-muted/10 p-16 text-center">
              <Award className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
              <h3 className="text-lg font-semibold text-foreground">Tidak ada template</h3>
              <p className="mt-2 text-muted-foreground">Belum ada template yang cocok dengan filter.</p>
              <Button onClick={openCreateModal} variant="outline" className="mt-4">
                <Plus className="h-4 w-4" />
                Tambah Template
              </Button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="border-b bg-slate-50/80 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Template</th>
                      <th className="px-6 py-4 font-semibold">Program</th>
                      <th className="px-6 py-4 font-semibold">Tipe</th>
                      <th className="px-6 py-4 font-semibold">Background</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 text-right font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-white">
                    {filteredTemplates.map((template) => (
                      <tr key={template.id} className="hover:bg-primary/5">
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-800">{template.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Update {new Date(template.updated_at).toLocaleDateString("id-ID")}</p>
                        </td>
                        <td className="px-6 py-4 text-slate-700">{programMap.get(template.program_id)?.name ?? "-"}</td>
                        <td className="px-6 py-4"><Badge variant="outline">{template.template_type.toUpperCase()}</Badge></td>
                        <td className="px-6 py-4">
                          {template.background_object_key ? (
                            <span className="max-w-[220px] truncate font-mono text-xs text-slate-600">{template.background_object_key}</span>
                          ) : (
                            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Belum diisi</Badge>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="outline" className={statusMeta[template.status].className}>{statusMeta[template.status].label}</Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button variant="outline" size="sm" className="h-9" onClick={() => openEditModal(template)}>
                              <Edit2 className="h-4 w-4" />
                              Edit
                            </Button>
                            <Button variant="outline" size="sm" className="h-9" onClick={() => archiveTemplate(template)}>
                              <Archive className="h-4 w-4" />
                              {template.status === "active" ? "Arsip" : "Aktifkan"}
                            </Button>
                            <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => deleteTemplate(template)}>
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <Card className="max-h-[90vh] w-full max-w-3xl overflow-hidden shadow-2xl">
            <CardHeader className="flex flex-row items-start justify-between gap-4 border-b">
              <div>
                <CardTitle>{editingTemplateId ? "Edit Template" : "Tambah Template"}</CardTitle>
                <CardDescription>Atur program, tipe template, background, dan JSON koordinat.</CardDescription>
              </div>
              <Button variant="ghost" className="h-9 w-9 p-0" onClick={() => setIsModalOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="max-h-[72vh] space-y-4 overflow-y-auto p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Program</label>
                  <select className="field-control h-10 bg-white" value={form.program_id} onChange={(event) => setForm((current) => ({ ...current, program_id: event.target.value }))}>
                    <option value="">Pilih Program</option>
                    {programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Nama Template</label>
                  <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Syahadah Tahsin Reguler" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Tipe</label>
                  <select className="field-control h-10 bg-white" value={form.template_type} onChange={(event) => setForm((current) => ({ ...current, template_type: event.target.value as CertificateTemplateType }))}>
                    <option value="html">HTML</option>
                    <option value="json">JSON</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Status</label>
                  <select className="field-control h-10 bg-white" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as CertificateTemplateStatus }))}>
                    <option value="active">Aktif</option>
                    <option value="archived">Arsip</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Background Object Key</label>
                <Input value={form.background_object_key} onChange={(event) => setForm((current) => ({ ...current, background_object_key: event.target.value }))} placeholder="certificates/backgrounds/template-a.png" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Template Data JSON</label>
                <textarea
                  className="field-control min-h-[220px] font-mono text-xs"
                  value={form.template_data_json}
                  onChange={(event) => setForm((current) => ({ ...current, template_data_json: event.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-3 border-t pt-4">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Batal</Button>
                <Button type="button" disabled={isSaving || !form.program_id || !form.name.trim()} onClick={saveTemplate}>
                  {isSaving ? "Menyimpan..." : "Simpan Template"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function TemplateMetricCard({ title, value, description, icon: Icon }: { title: string; value: number; description: string; icon: typeof Award }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function WorkflowItem({ done, title, description, action, onClick }: { done: boolean; title: string; description: string; action: string; onClick: () => void }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex items-start gap-3">
        {done ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /> : <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />}
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          <Button type="button" variant={done ? "outline" : "default"} size="sm" className="mt-3 h-9" onClick={onClick}>
            {action}
          </Button>
        </div>
      </div>
    </div>
  );
}
