import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Plus, BookOpen, Clock, Settings, X, ArrowRight, Filter, GraduationCap, Edit2, Archive } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  allowedMvpFeatureFlags,
  defaultMvpFeatureFlags,
  mergeWithDefaultFeatureFlags,
  mvpFeatureFlagLabels,
  type MvpFeatureFlags,
  type MvpFeatureFlagKey,
  type Program,
  type ProgramStatus,
  type Unit,
} from "../../lib/organization";
import { supabase } from "../../lib/supabase";

type ProgramFormState = {
  unit_id: string;
  code: string;
  name: string;
  description: string;
  program_type: string;
  curriculum_model: string;
  delivery_mode: string;
  status: ProgramStatus;
  feature_flags: MvpFeatureFlags;
};

const initialProgramForm: ProgramFormState = {
  unit_id: "",
  code: "",
  name: "",
  description: "",
  program_type: "general",
  curriculum_model: "mandiri",
  delivery_mode: "online",
  status: "draft",
  feature_flags: defaultMvpFeatureFlags,
};

export function AdminProgramListPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [form, setForm] = useState<ProgramFormState>(initialProgramForm);
  
  // UI States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const [{ data: unitRows, error: unitError }, { data: programRows, error: programError }] =
      await Promise.all([
        supabase.from("units").select("id, organization_id, code, name, description, status").order("name"),
        supabase.from("programs").select("id, unit_id, code, name, description, program_type, curriculum_model, delivery_mode, status, feature_flags, units(code, name)").order("name"),
      ]);

    if (unitError || programError) {
      setErrorMessage(unitError?.message ?? programError?.message ?? "Gagal memuat data.");
    } else {
      setUnits((unitRows ?? []) as Unit[]);
      setPrograms((programRows ?? []) as unknown as Program[]);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const setFlag = (key: MvpFeatureFlagKey, value: boolean) => {
    if (key === "use_ai_assist" || key === "use_audio_submission" || key === "use_video_submission") {
      return;
    }
    setForm((current) => ({
      ...current,
      feature_flags: {
        ...current.feature_flags,
        [key]: value,
      },
    }));
  };

  const filteredPrograms = programs.filter((p) => {
    const nameMatch = (p.name || "").toLowerCase().includes(searchQuery.toLowerCase());
    const codeMatch = (p.code || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSearch = nameMatch || codeMatch;
    const matchesType = filterType === "all" || p.curriculum_model === filterType;
    const matchesStatus = filterStatus === "all" || p.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  const openCreateModal = () => {
    setForm(initialProgramForm);
    setEditingProgramId(null);
    setIsModalOpen(true);
  };

  const openEditModal = (p: Program) => {
    setForm({
      unit_id: p.unit_id,
      code: p.code,
      name: p.name,
      description: p.description || "",
      program_type: p.program_type,
      curriculum_model: p.curriculum_model,
      delivery_mode: p.delivery_mode,
      status: p.status,
      feature_flags: p.feature_flags,
    });
    setEditingProgramId(p.id);
    setIsModalOpen(true);
  };

  const archiveProgram = async (id: string, currentStatus: string) => {
    const action = currentStatus === "archived" ? "mengaktifkan kembali" : "mengarsipkan";
    const newStatus = currentStatus === "archived" ? "draft" : "archived";
    if (!window.confirm(`Apakah Anda yakin ingin ${action} program ini?`)) return;
    
    setIsLoading(true);
    const { error } = await supabase.from("programs").update({ status: newStatus }).eq("id", id);
    if (error) {
      setErrorMessage(error.message);
      setIsLoading(false);
    } else {
      setMessage(`Program berhasil di-${currentStatus === "archived" ? "aktifkan (draft)" : "arsipkan"}.`);
      await loadData();
    }
  };

  return (
    <div className="page-stack">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Katalog Program</h2>
          <p className="text-muted-foreground mt-1">Kelola dan kembangkan program pembelajaran Anda.</p>
        </div>
        <Button onClick={openCreateModal} className="rounded-full shadow-md hover:shadow-lg transition-all" size="lg">
          <Plus className="mr-2 h-5 w-5" /> Buat Program Baru
        </Button>
      </div>

      {errorMessage && (
        <Alert className="animate-in fade-in slide-in-from-top-2 border-red-500 bg-red-50 text-red-900">
          <AlertTitle>Gagal</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert className="animate-in fade-in border-emerald-500 text-emerald-700 bg-emerald-50">
          <AlertTitle>Berhasil</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {/* Filters & Search Toolbar */}
      <Card className="border-muted bg-muted/20 shadow-sm">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Cari nama atau kode program..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white border-muted-foreground/20"
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select 
              className="field-control bg-white h-10 w-full md:w-48 text-sm border-muted-foreground/20"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">Semua Tipe Program</option>
              <option value="mandiri">Mandiri (Evergreen)</option>
              <option value="angkatan">Terjadwal (Angkatan)</option>
            </select>
            <select 
              className="field-control bg-white h-10 w-full md:w-40 text-sm border-muted-foreground/20"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="draft">Draft</option>
              <option value="archived">Diarsipkan</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Program Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent"></div>
        </div>
      ) : filteredPrograms.length === 0 ? (
        <div className="text-center p-16 border-2 border-dashed rounded-xl bg-muted/10">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">Tidak ada program ditemukan</h3>
          <p className="text-muted-foreground mt-2">Belum ada program yang sesuai dengan filter Anda.</p>
          {programs.length === 0 && (
            <Button onClick={openCreateModal} variant="outline" className="mt-4 rounded-full">
              Buat Program Pertama Anda
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredPrograms.map((program) => (
            <Card key={program.id} className="overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border-border/50 group flex flex-col bg-card/95 backdrop-blur">
              <div className={`h-2 w-full ${program.status === 'active' ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : program.status === 'draft' ? 'bg-gradient-to-r from-amber-400 to-amber-300' : 'bg-slate-300'}`} />
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-semibold tracking-wider text-[10px]">
                    {program.code}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <Badge variant={program.status === "active" ? "default" : "secondary"} className="capitalize shadow-sm">
                      {program.status}
                    </Badge>
                    <div className="flex gap-1 ml-1">
                      <Button variant="ghost" className="h-8 w-8 p-0 rounded-full text-blue-500 hover:text-blue-700 hover:bg-blue-50" onClick={() => openEditModal(program)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" className={`h-8 w-8 p-0 rounded-full ${program.status === 'archived' ? 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50' : 'text-red-500 hover:text-red-700 hover:bg-red-50'}`} onClick={() => archiveProgram(program.id, program.status)}>
                        {program.status === 'archived' ? <BookOpen className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
                <CardTitle className="text-xl leading-tight group-hover:text-primary transition-colors">
                  {program.name}
                </CardTitle>
                <p className="text-sm text-muted-foreground line-clamp-2 mt-2 h-10">
                  {program.description || "Belum ada deskripsi untuk program ini."}
                </p>
              </CardHeader>
              <CardContent className="pb-4 flex-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3 bg-muted/30 p-2 rounded-lg">
                  {program.curriculum_model === "mandiri" ? (
                    <><Clock className="h-4 w-4 text-blue-500" /> <span className="font-medium text-foreground">Mandiri (Self-Paced)</span></>
                  ) : (
                    <><GraduationCap className="h-4 w-4 text-emerald-500" /> <span className="font-medium text-foreground">Terjadwal (Angkatan)</span></>
                  )}
                </div>
              </CardContent>
              <div className="pt-0 border-t bg-muted/5 p-4 mt-auto">
                <Link to={`/system/program/${program.id}`} className="w-full">
                  <Button variant="default" className="w-full rounded-lg shadow-sm group-hover:bg-primary/90 transition-colors">
                    Kelola Program <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200">
            <CardHeader className="sticky top-0 bg-background/95 backdrop-blur z-10 border-b flex flex-row items-center justify-between py-4">
              <div>
                <CardTitle className="text-2xl">{editingProgramId ? "Edit Program" : "Buat Program Baru"}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Konfigurasi dasar untuk program pembelajaran.</p>
              </div>
              <Button variant="ghost" className="h-10 w-10 p-0 rounded-full" onClick={() => setIsModalOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-6">
              <form
                className="space-y-6"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setIsSubmitting(true);
                  setErrorMessage(null);
                  setMessage(null);

                  const payload = {
                    unit_id: form.unit_id || (units.length > 0 ? units[0].id : ""),
                    code: form.code.trim(),
                    name: form.name.trim(),
                    description: form.description.trim() || null,
                    program_type: form.program_type.trim() || "general",
                    curriculum_model: form.curriculum_model.trim() || "mandiri",
                    delivery_mode: form.delivery_mode.trim() || "online",
                    status: form.status,
                    feature_flags: mergeWithDefaultFeatureFlags(form.feature_flags),
                  };

                  const request = editingProgramId 
                    ? supabase.from("programs").update(payload).eq("id", editingProgramId)
                    : supabase.from("programs").insert(payload);

                  const { error } = await request;

                  if (error) {
                    setErrorMessage(error.message);
                  } else {
                    setForm(initialProgramForm);
                    setEditingProgramId(null);
                    setMessage(`Program berhasil ${editingProgramId ? "diperbarui" : "dibuat"}.`);
                    setIsModalOpen(false);
                    await loadData();
                  }

                  setIsSubmitting(false);
                }}
              >
                {/* Hidden Unit Field */}
                <input type="hidden" value={form.unit_id || (units.length > 0 ? units[0].id : "")} />
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Nama Program <span className="text-red-500">*</span></label>
                    <Input
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Contoh: Tahsin Lanjutan"
                      required
                      value={form.name}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Kode Program <span className="text-red-500">*</span></label>
                    <Input
                      onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                      placeholder="Contoh: THL-02"
                      required
                      value={form.code}
                      className="h-10 uppercase"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold">Deskripsi Singkat</label>
                  <textarea
                    className="field-control min-h-[80px]"
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    placeholder="Jelaskan secara singkat apa yang dipelajari di program ini..."
                    value={form.description}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2 p-4 bg-muted/40 rounded-xl border">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold flex items-center gap-2">
                      <Settings className="h-4 w-4 text-primary" /> Sistem Pembelajaran
                    </label>
                    <select
                      className="field-control bg-white h-10"
                      onChange={(event) => setForm((current) => ({ ...current, curriculum_model: event.target.value }))}
                      value={form.curriculum_model}
                    >
                      <option value="mandiri">Mandiri (Evergreen / Self-Paced)</option>
                      <option value="angkatan">Terjadwal (Sistem Angkatan / Cohort)</option>
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {form.curriculum_model === 'mandiri' ? 'Peserta mendaftar dan belajar kapan saja.' : 'Peserta belajar bersama-sama dalam satu gelombang waktu.'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold">Status Awal</label>
                    <select
                      className="field-control bg-white h-10"
                      onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as ProgramStatus }))}
                      value={form.status}
                    >
                      <option value="draft">Draft (Disembunyikan)</option>
                      <option value="active">Active (Terlihat)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t">
                  <label className="text-sm font-semibold flex items-center justify-between pb-2">
                    <span>Fitur Tambahan (MVP)</span>
                    <span className="text-xs text-muted-foreground font-normal">Pilih fitur yang ingin diaktifkan</span>
                  </label>
                  <div className="grid gap-3 md:grid-cols-2 max-h-[200px] overflow-y-auto pr-2 rounded-xl p-2 bg-muted/20 border border-muted-foreground/10">
                    {allowedMvpFeatureFlags.map((flag) => {
                      const isForbidden = flag === "use_ai_assist" || flag === "use_audio_submission" || flag === "use_video_submission";
                      return (
                        <label key={flag} className={`flex items-start gap-3 p-3 rounded-lg border ${isForbidden ? 'opacity-50 bg-muted' : 'hover:bg-muted/50 cursor-pointer transition-colors'}`}>
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            checked={form.feature_flags[flag]}
                            disabled={isForbidden}
                            onChange={(event) => setFlag(flag, event.target.checked)}
                          />
                          <div>
                            <p className="text-sm font-medium">{mvpFeatureFlagLabels[flag]}</p>
                            {isForbidden && <p className="text-[10px] text-muted-foreground mt-0.5">Dinonaktifkan di versi ini</p>}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t flex justify-end gap-3 sticky bottom-0 bg-background py-4">
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                    Batal
                  </Button>
                  <Button disabled={isSubmitting} type="submit" className="px-8 shadow-md">
                    {isSubmitting ? "Menyimpan..." : editingProgramId ? "Simpan Perubahan" : "Buat Program"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
