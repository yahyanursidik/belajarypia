import { useEffect, useState } from "react";
import { Plus, Edit2, Trash, Award } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "../../../lib/supabase";

export function CertificateTemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    const { data, error } = await supabase.from("certificate_templates").select("*").order("name");
    
    if (error) {
      setErrorMessage(error.message);
    } else {
      setTemplates(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  return (
    <div className="page-stack">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Template Syahadah</h2>
          <p className="text-muted-foreground mt-1">Kelola desain dan koordinat template sertifikat kelulusan.</p>
        </div>
        <Button className="rounded-full shadow-md" size="lg">
          <Plus className="mr-2 h-5 w-5" /> Tambah Template
        </Button>
      </div>

      {errorMessage && (
        <Alert className="border-red-500 bg-red-50 text-red-900 mb-6">
          <AlertTitle>Gagal Memuat Data</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent"></div>
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center p-16 border-2 border-dashed rounded-xl bg-muted/10">
          <Award className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">Tidak ada template</h3>
          <p className="text-muted-foreground mt-2">Belum ada template syahadah yang ditambahkan.</p>
        </div>
      ) : (
        <Card className="border-border/50 shadow-sm overflow-hidden bg-white rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/80 border-b border-border/50 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-semibold">Nama Template</th>
                  <th className="px-6 py-4 font-semibold">Tipe</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 bg-white">
                {templates.map((template) => (
                  <tr key={template.id} className="hover:bg-primary/5 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="font-bold text-slate-800 text-base">{template.name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline">{template.template_type}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={template.status === "active" ? "default" : "secondary"}>
                        {template.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50">
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
