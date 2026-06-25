import { useEffect, useState } from "react";
import { Plus, Trash2, GripVertical, Settings } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { supabase } from "../../lib/supabase";

const toast = { success: alert, error: alert };

export function ProgramAdmissionBuilder({ programId }: { programId: string }) {
  const [form, setForm] = useState<any>(null);
  const [fields, setFields] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadForm();
  }, [programId]);

  const loadForm = async () => {
    setIsLoading(true);
    // Fetch main form
    let { data: formData, error: formError } = await supabase
      .from("registration_forms")
      .select("*")
      .eq("program_id", programId)
      .single();

    if (!formData && formError?.code === "PGRST116") {
      // Create draft form if not exist
      const { data: newForm, error: createError } = await supabase
        .from("registration_forms")
        .insert([{ program_id: programId, title: "Form Pendaftaran Program", status: "draft" }])
        .select()
        .single();
      
      if (!createError) formData = newForm;
    }

    if (formData) {
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
      toast.success("Status formulir pendaftaran diperbarui");
    } else {
      toast.error("Gagal memperbarui status");
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

  const updateField = async (id: string, updates: any) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
    await supabase.from("registration_form_fields").update(updates).eq("id", id);
  };

  const deleteField = async (id: string) => {
    setFields(fields.filter(f => f.id !== id));
    await supabase.from("registration_form_fields").delete().eq("id", id);
  };

  if (isLoading) return <div className="p-8 text-center text-slate-500">Memuat Form Builder...</div>;

  return (
    <div className="space-y-6">
      <Card className="border-indigo-100 shadow-sm">
        <CardHeader className="bg-indigo-50/50 border-b">
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
                {form?.status === 'active' ? 'Nonaktifkan Form' : 'Aktifkan Form'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Judul Formulir</label>
              <Input 
                value={form?.title || ""} 
                onChange={e => setForm({...form, title: e.target.value})} 
                onBlur={() => supabase.from("registration_forms").update({ title: form.title }).eq("id", form.id)}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Deskripsi / Instruksi</label>
              <textarea 
                className="w-full min-h-[100px] p-3 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                value={form?.description || ""} 
                onChange={e => setForm({...form, description: e.target.value})} 
                onBlur={() => supabase.from("registration_forms").update({ description: form.description }).eq("id", form.id)}
                placeholder="Misal: Harap isi data diri dengan benar. Siapkan file rekaman ngaji untuk diunggah."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-800">Field Tambahan (Custom Fields)</h3>
        <Button onClick={addField} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
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
          <Card key={field.id} className="relative overflow-hidden group border-slate-200 hover:border-indigo-300 transition-colors">
            <div className="absolute left-0 top-0 bottom-0 w-10 bg-slate-50 flex items-center justify-center border-r border-slate-100 cursor-move text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-400">
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
                      <select 
                        className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={field.field_type}
                        onChange={e => updateField(field.id, { field_type: e.target.value })}
                      >
                        <option value="text">Teks Pendek</option>
                        <option value="textarea">Teks Panjang</option>
                        <option value="select">Dropdown Pilihan</option>
                        <option value="file">Upload File / Audio</option>
                      </select>
                    </div>
                    <div className="flex items-end mb-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={field.is_required} 
                          onChange={e => updateField(field.id, { is_required: e.target.checked })}
                          className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
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
          <div className="text-center p-12 border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
            Tidak ada field tambahan. Hanya form standar yang akan ditampilkan.
          </div>
        )}
      </div>
    </div>
  );
}
