import { useEffect, useState } from "react";
import { Plus, Trash2, GripVertical, Settings, X, Loader2, Type, AlignLeft, List, FileUp, ExternalLink, Copy } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { supabase } from "../../lib/supabase";

export function ProgramAdmissionBuilder({ programId }: { programId: string }) {
  const [form, setForm] = useState<any>(null);
  const [fields, setFields] = useState<any[]>([]);
  const [program, setProgram] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (message || errorMessage) {
      const timer = setTimeout(() => {
        setMessage(null);
        setErrorMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message, errorMessage]);

  useEffect(() => {
    loadForm();
  }, [programId]);

  const loadForm = async () => {
    setIsLoading(true);
    // Fetch program
    const { data: programData } = await supabase
      .from("programs")
      .select("id, feature_flags")
      .eq("id", programId)
      .single();
    
    if (programData) {
      setProgram(programData);
    }

    // Fetch main form
    let { data: formData } = await supabase
      .from("registration_forms")
      .select("*")
      .eq("program_id", programId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!formData) {
      // Create draft form if not exist
      const { data: newForm, error: createError } = await supabase
        .from("registration_forms")
        .insert([{ program_id: programId, title: "Form Pendaftaran Program", status: "draft" }])
        .select()
        .single();
      
      if (!createError) formData = newForm;
    }

    if (formData) {
      if (!formData.group_settings) {
        formData.group_settings = { platform: "none", separated_gender: false, ikhwan_groups: [], akhwat_groups: [], general_groups: [] };
      }
      setForm(formData);
      // Fetch fields
      const { data: fieldsData } = await supabase
        .from("registration_form_fields")
        .select("*")
        .eq("form_id", formData.id)
        .order("order_no", { ascending: true });
      
      if (fieldsData) setFields(fieldsData);
    }
    setIsLoading(false);
  };

  const saveFormStatus = async (status: string) => {
    if (!form) return;
    setIsSaving(true);
    const { error } = await supabase.from("registration_forms").update({ status }).eq("id", form.id);
    if (!error) {
      setForm({ ...form, status });
      setMessage("Status formulir pendaftaran diperbarui");
    } else {
      setErrorMessage("Gagal memperbarui status");
    }
    setIsSaving(false);
  };

  const addField = async () => {
    if (!form) return;
    const tempKey = `field_${Date.now()}`;
    const newField = {
      form_id: form.id,
      field_key: tempKey,
      label: "Pertanyaan Baru",
      field_type: "text",
      is_required: false,
      order_no: fields.length + 1
    };
    
    const { data, error } = await supabase.from("registration_form_fields").insert([newField]).select().single();
    if (!error && data) {
      setFields([...fields, data]);
    }
  };

  const updateField = (id: string, updates: any) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const deleteField = async (id: string) => {
    setFields(fields.filter(f => f.id !== id));
    await supabase.from("registration_form_fields").delete().eq("id", id);
  };

  const toggleDirectEnrollment = async (checked: boolean) => {
    if (!program) return;
    setIsSaving(true);
    const newFlags = { ...(program.feature_flags || {}), use_direct_enrollment: checked };
    const { error } = await supabase.from("programs").update({ feature_flags: newFlags }).eq("id", program.id);
    if (!error) {
      setProgram({ ...program, feature_flags: newFlags });
      setMessage(checked ? "Pendaftaran langsung diaktifkan" : "Pendaftaran menggunakan form diaktifkan");
    } else {
      setErrorMessage("Gagal mengubah pengaturan pendaftaran");
    }
    setIsSaving(false);
  };

  const updateGroupSettings = (key: string, value: any) => {
    const newSettings = { ...(form.group_settings || { platform: "none", separated_gender: false, ikhwan_groups: [], akhwat_groups: [], general_groups: [] }), [key]: value };
    setForm({ ...form, group_settings: newSettings });
  };

  const addGroupLink = (type: "ikhwan_groups" | "akhwat_groups" | "general_groups") => {
    const newSettings = { ...(form.group_settings || { platform: "none", separated_gender: false, ikhwan_groups: [], akhwat_groups: [], general_groups: [] }) };
    if (!newSettings[type]) newSettings[type] = [];
    newSettings[type] = [...newSettings[type], { name: "", link: "" }];
    setForm({ ...form, group_settings: newSettings });
  };

  const updateGroupLink = (type: "ikhwan_groups" | "akhwat_groups" | "general_groups", index: number, field: "name" | "link", value: string) => {
    const newSettings = { ...(form.group_settings || {}) };
    if (newSettings[type] && newSettings[type][index]) {
      newSettings[type][index][field] = value;
      setForm({ ...form, group_settings: newSettings });
    }
  };

  const removeGroupLink = (type: "ikhwan_groups" | "akhwat_groups" | "general_groups", index: number) => {
    const newSettings = { ...(form.group_settings || {}) };
    if (newSettings[type]) {
      newSettings[type] = newSettings[type].filter((_: any, i: number) => i !== index);
      setForm({ ...form, group_settings: newSettings });
    }
  };

  const saveAllChanges = async () => {
    if (!form) return;
    setIsSavingAll(true);
    setErrorMessage(null);
    setMessage(null);

    const { error: formError } = await supabase
      .from("registration_forms")
      .update({
        title: form.title,
        description: form.description,
        group_settings: form.group_settings,
      })
      .eq("id", form.id);

    const fieldsToSave = fields.map(f => ({
      id: f.id,
      form_id: f.form_id,
      field_key: f.field_key,
      label: f.label,
      field_type: f.field_type,
      is_required: f.is_required,
      options_json: f.options_json,
      order_no: f.order_no,
    }));
    
    let fieldsError = null;
    if (fieldsToSave.length > 0) {
      const { error } = await supabase.from("registration_form_fields").upsert(fieldsToSave);
      fieldsError = error;
    }

    if (formError || fieldsError) {
      setErrorMessage(formError?.message || fieldsError?.message || "Terjadi kesalahan saat menyimpan perubahan.");
    } else {
      setMessage("Semua perubahan berhasil disimpan.");
    }
    
    setIsSavingAll(false);
  };

  if (isLoading) return <div className="p-8 text-center text-slate-500">Memuat Form Builder...</div>;

  const isDirectEnrollment = program?.feature_flags?.use_direct_enrollment === true;

  return (
    <div className="space-y-6 relative">
      <div className="fixed top-24 right-8 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {errorMessage && (
          <div className="bg-red-50 text-red-900 border border-red-200 p-4 rounded-lg shadow-lg flex items-start justify-between animate-in slide-in-from-right-8 fade-in pointer-events-auto">
            <div>
              <h4 className="font-bold text-sm">Gagal</h4>
              <p className="text-sm mt-1">{errorMessage}</p>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-red-500 hover:text-red-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {message && (
          <div className="bg-emerald-50 text-emerald-900 border border-emerald-200 p-4 rounded-lg shadow-lg flex items-start justify-between animate-in slide-in-from-right-8 fade-in pointer-events-auto">
            <div>
              <h4 className="font-bold text-sm">Berhasil</h4>
              <p className="text-sm mt-1">{message}</p>
            </div>
            <button onClick={() => setMessage(null)} className="text-emerald-500 hover:text-emerald-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <Card className="border-primary/20 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Mode Pendaftaran</h3>
              <p className="text-sm text-slate-500 mt-1">Pilih bagaimana calon peserta mendaftar ke program ini.</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span 
                className={`text-sm font-medium cursor-pointer ${!isDirectEnrollment ? 'text-primary' : 'text-slate-500'}`} 
                onClick={() => !isSaving && toggleDirectEnrollment(false)}
              >
                Gunakan Form
              </span>
              
              <button 
                type="button" 
                role="switch" 
                aria-checked={isDirectEnrollment}
                disabled={isSaving}
                onClick={() => toggleDirectEnrollment(!isDirectEnrollment)}
                className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${isDirectEnrollment ? 'bg-emerald-500' : 'bg-slate-300'}`}
              >
                <span className={`pointer-events-none block h-7 w-7 rounded-full bg-white shadow-lg ring-0 transition-transform ${isDirectEnrollment ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
              
              <span 
                className={`text-sm font-medium cursor-pointer ${isDirectEnrollment ? 'text-emerald-700' : 'text-slate-500'}`} 
                onClick={() => !isSaving && toggleDirectEnrollment(true)}
              >
                Daftar Langsung (1-Klik)
              </span>
            </div>
          </div>
          
          {isDirectEnrollment && (
            <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm">
              <p className="font-semibold mb-1">Pendaftaran Langsung Aktif</p>
              <p>Program ini akan muncul di Dashboard Peserta (Learner Dashboard). Peserta yang sudah login dapat langsung klik "Daftar" dan otomatis terdaftar tanpa mengisi form pendaftaran di bawah.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className={`transition-opacity ${isDirectEnrollment ? 'opacity-50 pointer-events-none' : ''}`}>
        <Card className="border-primary/20 shadow-sm">
        <CardHeader className="bg-primary/5 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Pengaturan Formulir Pendaftaran</CardTitle>
              <CardDescription>Form ini akan muncul di halaman publik saat calon peserta mendaftar.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 text-xs font-bold uppercase rounded-md ${form?.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                {form?.status}
              </span>
              <Button size="sm" variant={form?.status === 'active' ? 'outline' : 'default'} onClick={() => saveFormStatus(form?.status === 'active' ? 'draft' : 'active')} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {form?.status === 'active' ? 'Nonaktifkan Form' : 'Aktifkan Form'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* Tautan Pendaftaran Eksternal (Publik) */}
          <div className="p-4 bg-indigo-50/40 border border-indigo-100 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Tautan Pendaftaran Eksternal (Publik)</span>
              <code className="text-xs text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-100/50 break-all select-all font-mono">
                {`${window.location.origin}/pendaftaran/${programId}`}
              </code>
            </div>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/pendaftaran/${programId}`);
                  setMessage("Tautan berhasil disalin ke clipboard!");
                }}
                className="shrink-0 bg-white hover:bg-slate-50 border-indigo-200 text-indigo-700 hover:text-indigo-800"
              >
                <Copy className="h-3.5 w-3.5 mr-1" /> Salin Tautan
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                asChild
                className="shrink-0 bg-white hover:bg-slate-50 text-slate-700"
              >
                <a href={`/pendaftaran/${programId}`} target="_blank" rel="noopener noreferrer">
                  Buka <ExternalLink className="h-3.5 w-3.5 ml-1" />
                </a>
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Judul Formulir</label>
              <Input 
                value={form?.title || ""} 
                onChange={e => setForm({...form, title: e.target.value})} 
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Deskripsi / Instruksi</label>
              <textarea 
                className="w-full min-h-[100px] p-3 rounded-md border border-input focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                value={form?.description || ""} 
                onChange={e => setForm({...form, description: e.target.value})} 
                placeholder="Misal: Harap isi data diri dengan benar. Siapkan file rekaman ngaji untuk diunggah."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 shadow-sm mt-6 mb-6">
        <CardHeader className="bg-primary/5 border-b">
          <CardTitle className="text-lg">Pengaturan Grup Komunitas</CardTitle>
          <CardDescription>Atur grup WhatsApp/Telegram yang akan ditampilkan setelah pendaftar berhasil mendaftar.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Platform</label>
                <select 
                  className="w-full h-10 rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form?.group_settings?.platform || "none"}
                  onChange={(e) => updateGroupSettings("platform", e.target.value)}
                >
                  <option value="none">Tidak Ada / Jangan Tampilkan</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="telegram">Telegram</option>
                </select>
              </div>
              
              {form?.group_settings?.platform !== "none" && (
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={form?.group_settings?.separated_gender || false}
                      onChange={(e) => updateGroupSettings("separated_gender", e.target.checked)}
                      className="rounded text-primary focus:ring-primary h-4 w-4"
                    />
                    <span className="text-sm font-semibold text-slate-700">Pisahkan Grup Ikhwan dan Akhwat</span>
                  </label>
                </div>
              )}
            </div>

            {form?.group_settings?.platform !== "none" && (
              <div className="space-y-6 pt-4 border-t">
                {form?.group_settings?.separated_gender ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Ikhwan Groups */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-700">Grup Ikhwan</h4>
                        <Button type="button" size="sm" variant="outline" onClick={() => addGroupLink("ikhwan_groups")}>
                          <Plus className="h-4 w-4 mr-1" /> Tambah
                        </Button>
                      </div>
                      {(form?.group_settings?.ikhwan_groups || []).map((grp: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-2">
                          <div className="flex-1 space-y-2">
                            <Input placeholder="Nama Grup" value={grp.name} onChange={(e) => updateGroupLink("ikhwan_groups", idx, "name", e.target.value)} />
                            <Input placeholder="Tautan" value={grp.link} onChange={(e) => updateGroupLink("ikhwan_groups", idx, "link", e.target.value)} />
                          </div>
                          <Button type="button" variant="ghost" size="icon" className="text-rose-500" onClick={() => removeGroupLink("ikhwan_groups", idx)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      ))}
                      {!(form?.group_settings?.ikhwan_groups?.length) && <p className="text-sm text-slate-400">Belum ada grup ikhwan.</p>}
                    </div>

                    {/* Akhwat Groups */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-700">Grup Akhwat</h4>
                        <Button type="button" size="sm" variant="outline" onClick={() => addGroupLink("akhwat_groups")}>
                          <Plus className="h-4 w-4 mr-1" /> Tambah
                        </Button>
                      </div>
                      {(form?.group_settings?.akhwat_groups || []).map((grp: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-2">
                          <div className="flex-1 space-y-2">
                            <Input placeholder="Nama Grup" value={grp.name} onChange={(e) => updateGroupLink("akhwat_groups", idx, "name", e.target.value)} />
                            <Input placeholder="Tautan" value={grp.link} onChange={(e) => updateGroupLink("akhwat_groups", idx, "link", e.target.value)} />
                          </div>
                          <Button type="button" variant="ghost" size="icon" className="text-rose-500" onClick={() => removeGroupLink("akhwat_groups", idx)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      ))}
                      {!(form?.group_settings?.akhwat_groups?.length) && <p className="text-sm text-slate-400">Belum ada grup akhwat.</p>}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-700">Tautan Grup</h4>
                      <Button type="button" size="sm" variant="outline" onClick={() => addGroupLink("general_groups")}>
                        <Plus className="h-4 w-4 mr-1" /> Tambah Tautan
                      </Button>
                    </div>
                    {(form?.group_settings?.general_groups || []).map((grp: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 max-w-md">
                        <div className="flex-1 space-y-2">
                          <Input placeholder="Nama Grup" value={grp.name} onChange={(e) => updateGroupLink("general_groups", idx, "name", e.target.value)} />
                          <Input placeholder="Tautan" value={grp.link} onChange={(e) => updateGroupLink("general_groups", idx, "link", e.target.value)} />
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="text-rose-500" onClick={() => removeGroupLink("general_groups", idx)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                    {!(form?.group_settings?.general_groups?.length) && <p className="text-sm text-slate-400">Belum ada tautan grup.</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-800">Field Tambahan (Custom Fields)</h3>
        <Button onClick={addField} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Tambah Field
        </Button>
      </div>

      <div className="space-y-4">
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500 flex items-center gap-3">
          <Settings className="h-5 w-5 text-slate-400" />
          <div>
            <p className="font-semibold text-slate-700 mb-0.5">Field Standar Bawaan (Sudah ada di form)</p>
            <p>Nama Lengkap, Email, No. WhatsApp, Kota Domisili, Jenis Kelamin, Tanggal Lahir.</p>
          </div>
        </div>

        {fields.map((field) => (
          <Card key={field.id} className="relative overflow-hidden group border-slate-200 hover:border-primary/30 transition-colors">
            <div className="absolute left-0 top-0 bottom-0 w-10 bg-slate-50 flex items-center justify-center border-r border-slate-100 cursor-move text-slate-400 group-hover:bg-primary/5 group-hover:text-primary">
              <GripVertical className="h-5 w-5" />
            </div>
            <CardContent className="p-5 pl-14">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Label Pertanyaan</label>
                    <Input 
                      value={field.label} 
                      onChange={e => updateField(field.id, { label: e.target.value })}
                      placeholder="Misal: Asal Sekolah"
                    />
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Tipe Field</label>
                      <div className="relative">
                        {field.field_type === 'text' && <Type className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />}
                        {field.field_type === 'textarea' && <AlignLeft className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />}
                        {field.field_type === 'select' && <List className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />}
                        {field.field_type === 'file' && <FileUp className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />}
                        <select 
                          className="w-full h-10 rounded-md border border-input bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          value={field.field_type}
                          onChange={e => updateField(field.id, { field_type: e.target.value })}
                        >
                          <option value="text">Teks Pendek</option>
                          <option value="textarea">Teks Panjang</option>
                          <option value="select">Dropdown Pilihan</option>
                          <option value="file">Upload File / Audio</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex items-end mb-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={field.is_required} 
                          onChange={e => updateField(field.id, { is_required: e.target.checked })}
                          className="rounded text-primary focus:ring-primary h-4 w-4"
                        />
                        <span className="text-sm font-medium text-slate-700">Wajib Diisi</span>
                      </label>
                    </div>
                  </div>
                  {field.field_type === 'select' && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Pilihan Dropdown (Pisahkan dengan koma)</label>
                      <Input 
                        defaultValue={field.options_json ? field.options_json.join(", ") : ""}
                        onBlur={e => {
                          const arr = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
                          updateField(field.id, { options_json: arr });
                        }}
                        placeholder="Misal: SD, SMP, SMA"
                      />
                    </div>
                  )}
                  {field.field_type === 'file' && (
                    <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-100">
                      File akan diunggah ke Storage publik. Gunakan field ini untuk meminta pas foto, scan dokumen, atau rekaman suara.
                    </p>
                  )}
                </div>
                <div className="flex sm:flex-col items-center justify-center gap-2 pt-6 sm:pt-0 border-t sm:border-t-0 sm:border-l pl-4 shrink-0">
                  <Button variant="ghost" size="sm" className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 w-full" onClick={() => deleteField(field.id)}>
                    <Trash2 className="h-4 w-4 mr-2 sm:mr-0" />
                    <span className="sm:hidden">Hapus</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {fields.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 bg-white">
            <Settings className="h-12 w-12 text-slate-300 mb-4" />
            <p className="text-sm font-medium text-slate-700">Belum ada field tambahan</p>
            <p className="text-xs mt-1 max-w-md text-center">Hanya form standar bawaan (Nama, Email, WhatsApp, dsb) yang akan ditampilkan kepada calon peserta saat mendaftar.</p>
          </div>
        )}
      </div>
      <div className="sticky bottom-6 mt-8 flex justify-end border-t border-slate-200 pt-4 bg-white/80 backdrop-blur-sm z-40 p-4 rounded-lg shadow-sm">
        <Button onClick={saveAllChanges} disabled={isSavingAll || isLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[200px] shadow-md">
          {isSavingAll ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Simpan Perubahan
        </Button>
      </div>
      </div>
    </div>
  );
}
