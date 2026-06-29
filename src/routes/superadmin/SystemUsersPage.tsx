import { useEffect, useState, useMemo } from "react";
import { Search, Edit2, Shield, User as UserIcon, X, Check } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "../../lib/supabase";

export function SystemUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");

  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [userRolesInput, setUserRolesInput] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    // Fetch roles
    const { data: rolesData, error: rolesError } = await supabase
      .from("roles")
      .select("id, code, name")
      .order("name");

    // Fetch profiles with user_roles
    const { data: usersData, error: usersError } = await supabase
      .from("profiles")
      .select(`
        id, full_name, email, status,
        user_roles (
          id, role_id, roles (id, code, name)
        )
      `)
      .order("created_at", { ascending: false });

    if (rolesError || usersError) {
      setErrorMessage(rolesError?.message || usersError?.message || "Terjadi kesalahan.");
    } else {
      setRoles(rolesData || []);
      setUsers(usersData || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch = 
        (u.full_name || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
        (u.email || "").toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchRole = filterRole === "all" || (u.user_roles || []).some((ur: any) => ur.roles?.code === filterRole);

      return matchSearch && matchRole;
    });
  }, [users, searchQuery, filterRole]);

  const openEditModal = (user: any) => {
    setEditingUser(user);
    const activeRoles = (user.user_roles || []).map((ur: any) => ur.roles?.code).filter(Boolean);
    setUserRolesInput(activeRoles);
  };

  const handleToggleRole = (code: string) => {
    if (userRolesInput.includes(code)) {
      setUserRolesInput(userRolesInput.filter(r => r !== code));
    } else {
      setUserRolesInput([...userRolesInput, code]);
    }
  };

  const saveRoles = async () => {
    if (!editingUser) return;
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // Find what to add and what to remove
      const currentRoles = (editingUser.user_roles || []).map((ur: any) => ur.roles?.code).filter(Boolean);
      
      const toAdd = userRolesInput.filter(code => !currentRoles.includes(code));
      const toRemove = currentRoles.filter((code: string) => !userRolesInput.includes(code));

      // 1. Add roles
      if (toAdd.length > 0) {
        const insertData = toAdd.map(code => {
          const roleObj = roles.find(r => r.code === code);
          return { user_id: editingUser.id, role_id: roleObj.id };
        });
        const { error: insertError } = await supabase.from("user_roles").insert(insertData);
        if (insertError) throw insertError;
      }

      // 2. Remove roles
      if (toRemove.length > 0) {
        const removeRoleIds = toRemove.map(code => roles.find(r => r.code === code)?.id).filter(Boolean);
        const { error: removeError } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", editingUser.id)
          .in("role_id", removeRoleIds);
        if (removeError) throw removeError;
      }

      setSuccessMessage("Role pengguna berhasil diperbarui!");
      setEditingUser(null);
      await loadData();
    } catch (error: any) {
      setErrorMessage(error.message);
    }
    
    setIsSaving(false);
  };

  return (
    <div className="page-stack">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Akses & Pengguna</h2>
          <p className="text-muted-foreground mt-1">Kelola daftar akun dan hak akses pengguna dalam sistem.</p>
        </div>
      </div>

      {errorMessage && (
        <Alert className="border-red-500 bg-red-50 text-red-900 mb-6">
          <AlertTitle>Gagal</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="border-emerald-500 bg-emerald-50 text-emerald-900 mb-6">
          <AlertTitle>Berhasil</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Toolbar */}
      <div className="bg-white/80 backdrop-blur-md border border-muted/60 shadow-sm rounded-xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Cari nama atau email..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-white/50 focus:bg-white border-muted/40 h-11 rounded-lg transition-all shadow-sm"
          />
        </div>
        <div className="flex items-center gap-2 bg-muted/20 px-3 py-1.5 rounded-lg border border-muted/40 w-full md:w-auto">
          <Shield className="h-4 w-4 text-muted-foreground hidden sm:block" />
          <select 
            className="bg-transparent border-none text-sm font-medium focus:ring-0 outline-none cursor-pointer text-slate-700 w-full md:w-auto"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="all">Semua Role</option>
            {roles.map((r) => (
              <option key={r.code} value={r.code}>{r.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent"></div>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center p-16 border-2 border-dashed rounded-xl bg-muted/10">
          <UserIcon className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">Pengguna Tidak Ditemukan</h3>
          <p className="text-muted-foreground mt-2">Tidak ada pengguna yang sesuai dengan pencarian Anda.</p>
        </div>
      ) : (
        <Card className="border-border/50 shadow-sm overflow-hidden bg-white rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/80 border-b border-border/50 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-semibold">Pengguna</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Roles</th>
                  <th className="px-6 py-4 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 bg-white">
                {filteredUsers.map((u) => {
                  const initial = (u.full_name || u.email || "U")[0].toUpperCase();
                  const uRoles = (u.user_roles || []).map((ur: any) => ur.roles).filter(Boolean);

                  return (
                    <tr key={u.id} className="hover:bg-primary/5 transition-colors group">
                      <td className="px-6 py-4 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20 shrink-0">
                          {initial}
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <span className="font-bold text-slate-800 text-base truncate">{u.full_name || "-"}</span>
                          <span className="text-sm text-slate-500 truncate">{u.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={u.status === "active" ? "default" : "secondary"} className="capitalize shadow-sm">
                          {u.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {uRoles.length === 0 ? (
                            <span className="text-xs text-muted-foreground italic">Tidak ada role</span>
                          ) : (
                            uRoles.map((r: any) => (
                              <Badge key={r.code} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                {r.name}
                              </Badge>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="outline" size="sm" onClick={() => openEditModal(u)} className="shadow-sm">
                          <Edit2 className="h-4 w-4 mr-2 text-slate-400" />
                          Kelola Role
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Edit Role Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <CardHeader className="border-b shrink-0 flex flex-row items-center justify-between py-4">
              <div>
                <CardTitle className="text-xl">Kelola Akses</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Pilih hak akses untuk <strong className="text-slate-800">{editingUser.full_name || editingUser.email}</strong>.
                </p>
              </div>
              <Button variant="ghost" className="h-8 w-8 p-0 rounded-full shrink-0" onClick={() => setEditingUser(null)}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto">
              <div className="p-4 space-y-2">
                {roles.map((r) => {
                  const isActive = userRolesInput.includes(r.code);
                  return (
                    <label 
                      key={r.code} 
                      className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        isActive 
                          ? 'border-primary bg-primary/5 shadow-sm' 
                          : 'border-transparent bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-5 w-5 rounded border flex items-center justify-center transition-colors ${
                          isActive ? 'bg-primary border-primary text-primary-foreground' : 'border-slate-300 bg-white'
                        }`}>
                          {isActive && <Check className="h-3 w-3 stroke-[3]" />}
                        </div>
                        <div>
                          <p className={`font-semibold text-sm ${isActive ? 'text-primary' : 'text-slate-700'}`}>{r.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5 font-mono">{r.code}</p>
                        </div>
                      </div>
                      <input 
                        type="checkbox" 
                        className="sr-only" 
                        checked={isActive} 
                        onChange={() => handleToggleRole(r.code)} 
                      />
                    </label>
                  );
                })}
              </div>
            </CardContent>
            <div className="p-4 border-t shrink-0 flex justify-end gap-3 bg-slate-50/80 rounded-b-xl">
              <Button type="button" variant="outline" onClick={() => setEditingUser(null)} disabled={isSaving}>
                Batal
              </Button>
              <Button onClick={saveRoles} disabled={isSaving} className="shadow-md">
                {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
