import { useEffect, useState, useMemo } from "react";
import { Search, User, MapPin, GraduationCap, Download } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { supabase } from "../../lib/supabase";

type ProgramParticipantRow = {
  id: string;
  enrollment_number: string;
  enrollment_status: string;
  participants: {
    id: string;
    display_name: string;
    global_participant_number: string;
    city: string | null;
    gender: string | null;
    education_level: string | null;
    status: string;
    profiles?: {
      email: string;
      phone: string | null;
    } | null;
  };
};

export function ProgramParticipants({ programId }: { programId: string }) {
  const [rows, setRows] = useState<ProgramParticipantRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchParticipants();
  }, [programId]);

  const fetchParticipants = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("enrollments")
      .select(`
        id, enrollment_number, enrollment_status,
        participants!inner (
          id, display_name, global_participant_number, city, gender, education_level, status,
          profiles ( email, phone )
        )
      `)
      .eq("program_id", programId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setRows(data as unknown as ProgramParticipantRow[]);
    }
    setIsLoading(false);
  };

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (!searchQuery) return true;
      const lowerQ = searchQuery.toLowerCase();
      const p = r.participants;
      return (
        p.display_name.toLowerCase().includes(lowerQ) ||
        r.enrollment_number.toLowerCase().includes(lowerQ) ||
        p.global_participant_number.toLowerCase().includes(lowerQ) ||
        (p.profiles?.email || "").toLowerCase().includes(lowerQ)
      );
    });
  }, [rows, searchQuery]);

  const exportToCSV = () => {
    const csvRows = [
      ["NIS", "No. Pendaftaran", "Nama", "Email", "No. HP", "Kota", "Pendidikan", "Gender", "Status Enrollment", "Last Login"]
    ];
    for (const row of filteredRows) {
      const p = row.participants;
      csvRows.push([
        `"${p.global_participant_number}"`,
        `"${row.enrollment_number}"`,
        `"${p.display_name}"`,
        `"${p.profiles?.email || ""}"`,
        `"${p.profiles?.phone || ""}"`,
        `"${p.city || ""}"`,
        `"${p.education_level || ""}"`,
        `"${p.gender || ""}"`,
        `"${row.enrollment_status}"`,
        `"-"` // Mocking last login
      ]);
    }
    const csvString = csvRows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Data_Peserta_Program_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50 p-4 rounded-lg border border-slate-100">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Cari nama, NIS, atau email peserta..." 
            className="w-full pl-9 pr-4 py-2 text-sm border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button variant="outline" size="sm" onClick={exportToCSV} className="w-full sm:w-auto flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">Profil Peserta</th>
                <th className="px-6 py-4 font-semibold">Kontak & Domisili</th>
                <th className="px-6 py-4 font-semibold">Pendidikan & Gender</th>
                <th className="px-6 py-4 font-semibold text-center">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Last Login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="h-8 w-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                      <p className="font-medium">Memuat data peserta...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-slate-500">
                    <User className="h-16 w-16 mx-auto mb-4 text-slate-200" />
                    <p className="font-medium text-lg text-slate-600">Tidak ada peserta</p>
                    <p className="text-sm">Belum ada peserta di program ini atau pencarian tidak ditemukan.</p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                          {row.participants.display_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 group-hover:text-primary transition-colors">
                            {row.participants.display_name}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 border border-slate-200">
                              {row.participants.global_participant_number}
                            </span>
                            <span>•</span>
                            <span>{row.enrollment_number}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1.5">
                        <p className="text-slate-600 flex items-center gap-2">
                          <User className="h-3.5 w-3.5 opacity-70" />
                          {row.participants.profiles?.email || "-"}
                        </p>
                        <p className="text-slate-600 flex items-center gap-2 text-xs">
                          <MapPin className="h-3.5 w-3.5 opacity-70" />
                          {row.participants.city || "Kota belum diisi"}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1.5">
                        <p className="text-slate-600 flex items-center gap-2">
                          <GraduationCap className="h-3.5 w-3.5 opacity-70" />
                          {row.participants.education_level || "-"}
                        </p>
                        <p className="text-slate-500 text-xs pl-5">
                          {row.participants.gender || "-"}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant={row.enrollment_status === 'active' ? 'default' : 'secondary'}>
                        {row.enrollment_status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right text-slate-400 font-mono text-xs">
                      -
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-xs text-slate-500 flex justify-between">
          <span>Total: {filteredRows.length} peserta</span>
          <span>*Last login info is currently unavailable</span>
        </div>
      </Card>
    </div>
  );
}
