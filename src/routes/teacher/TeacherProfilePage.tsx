import { useState, useEffect } from "react";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { supabase } from "../../lib/supabase";
import { User, Lock, Mail, Phone, ShieldCheck, CheckCircle2, Loader2, Save, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";

export function TeacherProfilePage() {
  const { profile, primaryRole, refresh, signOut } = useAuthSession();
  const navigate = useNavigate();
  
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      // @ts-ignore - Assuming phone exists on profile in DB
      setPhone(profile.phone || "");
    }
  }, [profile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    setIsSavingProfile(true);
    setProfileSuccess(false);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          // @ts-ignore
          phone: phone,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id);
        
      if (error) throw error;
      
      await refresh();
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (error: any) {
      console.error("Error updating profile:", error);
      alert("Gagal memperbarui profil: " + error.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess(false);
    
    if (newPassword.length < 6) {
      setPasswordError("Kata sandi minimal 6 karakter");
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordError("Konfirmasi kata sandi tidak cocok");
      return;
    }
    
    setIsSavingPassword(true);
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) throw error;
      
      setPasswordSuccess(true);
      setNewPassword("");
      setConfirmPassword("");
      
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (error: any) {
      console.error("Error updating password:", error);
      setPasswordError("Gagal merubah kata sandi: " + error.message);
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="page-stack space-y-6 max-w-4xl mx-auto pb-12 animate-in fade-in">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Profil Pengajar</h2>
        <p className="text-muted-foreground mt-1">Kelola informasi pribadi dan pengaturan keamanan akun Anda.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Info */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <User className="h-5 w-5" />
              </div>
              <CardTitle>Data Pribadi</CardTitle>
            </div>
            <CardDescription>Informasi profil yang tampil di sistem.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nama Lengkap</label>
                <Input 
                  value={fullName} 
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Masukkan nama lengkap" 
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Nomor WhatsApp / Telepon</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    className="pl-9"
                    value={phone} 
                    onChange={e => setPhone(e.target.value)}
                    placeholder="Contoh: 08123456789" 
                  />
                </div>
              </div>
              
              <div className="space-y-2 pt-2">
                <label className="text-sm font-medium text-slate-500">Email Akun (Tidak dapat diubah)</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    className="pl-9 bg-slate-50 text-slate-500" 
                    value={profile?.email || ""} 
                    disabled 
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 pb-2">
                <label className="text-sm font-medium text-slate-500 block mb-2">Peran Utama</label>
                <Badge variant="outline" className="capitalize bg-slate-50 text-slate-600">
                  {primaryRole}
                </Badge>
              </div>
              
              <Button type="submit" disabled={isSavingProfile} className="w-full mt-4">
                {isSavingProfile ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</>
                ) : profileSuccess ? (
                  <><CheckCircle2 className="mr-2 h-4 w-4 text-emerald-200" /> Tersimpan</>
                ) : (
                  <><Save className="mr-2 h-4 w-4" /> Simpan Perubahan</>
                )}
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100 md:hidden">
              <Button 
                variant="outline" 
                className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-colors"
                onClick={async () => {
                  await signOut();
                  navigate("/teacher/login", { replace: true });
                }}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Keluar dari Akun (Logout)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Password Update */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <CardTitle>Keamanan & Akses</CardTitle>
            </div>
            <CardDescription>Perbarui kata sandi untuk mengamankan akun.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Kata Sandi Baru</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    type="password"
                    className="pl-9"
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Minimal 6 karakter" 
                  />
                </div>
              </div>
              
              <div className="space-y-2 pb-2">
                <label className="text-sm font-medium">Konfirmasi Kata Sandi Baru</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    type="password"
                    className="pl-9"
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi kata sandi" 
                  />
                </div>
              </div>

              {passwordError && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-200 flex items-start gap-2">
                  <div className="mt-0.5">⚠️</div>
                  <p>{passwordError}</p>
                </div>
              )}
              
              <Button 
                type="submit" 
                variant="outline" 
                disabled={isSavingPassword || !newPassword || !confirmPassword} 
                className="w-full mt-4 bg-slate-50 hover:bg-slate-100 text-slate-700"
              >
                {isSavingPassword ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memproses...</>
                ) : passwordSuccess ? (
                  <><CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" /> Kata Sandi Diubah</>
                ) : (
                  "Ubah Kata Sandi"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
