import { useState, useEffect } from "react";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { supabase } from "../../lib/supabase";
import { User, Lock, Mail, Phone, ShieldCheck, CheckCircle2, Loader2, Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";

export function AdminProfilePage() {
  const { session, profile, primaryRole } = useAuthSession();
  
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
          phone: phone,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id);
        
      if (error) throw error;
      
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
    <div className="page-stack space-y-6 pb-12">
      <section className="page-hero">
        <Badge variant="secondary" className="mb-4 bg-white/20 text-white border-white/30 backdrop-blur-sm shadow-sm">
          PENGATURAN AKUN
        </Badge>
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="hidden md:flex h-20 w-20 rounded-2xl bg-white/10 backdrop-blur-xl items-center justify-center border border-white/20 shadow-inner">
            <User className="h-10 w-10 text-white drop-shadow-md" />
          </div>
          <div>
            <p className="text-white/70 text-sm font-medium mb-1 tracking-wide uppercase">Profil Saya</p>
            <h2 className="text-white text-3xl font-bold tracking-tight">Kelola Identitas & Keamanan</h2>
            <p className="text-white/80 max-w-xl text-sm leading-relaxed mt-1">
              Perbarui informasi kontak Anda atau ubah kata sandi untuk menjaga keamanan akun Anda di LMS YPIA.
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Profile Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/40 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary to-indigo-500"></div>
            <CardHeader className="bg-slate-50/50 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5 text-primary" />
                Informasi Personal
              </CardTitle>
              <CardDescription>
                Detail kontak dan nama yang akan ditampilkan di seluruh sistem.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Nama Lengkap</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        required
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        className="pl-9 h-11"
                        placeholder="Masukkan nama lengkap"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Alamat Surel (Email)</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input 
                        disabled
                        value={profile?.email || ""}
                        className="pl-9 h-11 bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed"
                        placeholder="Email Anda"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Email digunakan untuk login dan tidak dapat diubah di sini.</p>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Nomor Telepon</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        className="pl-9 h-11"
                        placeholder="0812xxxxxx"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between border-t mt-6">
                  <div>
                    {profileSuccess && (
                      <p className="text-sm text-emerald-600 font-medium flex items-center gap-1.5 animate-in fade-in duration-300">
                        <CheckCircle2 className="h-4 w-4" /> Profil berhasil diperbarui
                      </p>
                    )}
                  </div>
                  <Button 
                    type="submit" 
                    disabled={isSavingProfile}
                    className="min-w-[140px]"
                  >
                    {isSavingProfile ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Menyimpan...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" /> Simpan Profil
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-border/40 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-slate-700 to-slate-900"></div>
            <CardHeader className="bg-slate-50/50 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lock className="h-5 w-5 text-slate-700" />
                Keamanan Kata Sandi
              </CardTitle>
              <CardDescription>
                Ganti kata sandi Anda secara berkala untuk menjaga keamanan akun.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Kata Sandi Baru</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        type="password"
                        required
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        className="pl-9 h-11"
                        placeholder="Minimal 6 karakter"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Konfirmasi Kata Sandi Baru</label>
                    <div className="relative">
                      <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className="pl-9 h-11"
                        placeholder="Ketik ulang kata sandi"
                      />
                    </div>
                  </div>
                </div>

                {passwordError && (
                  <p className="text-sm text-red-500 font-medium mt-2 animate-in fade-in">{passwordError}</p>
                )}

                <div className="pt-4 flex items-center justify-between border-t mt-6">
                  <div>
                    {passwordSuccess && (
                      <p className="text-sm text-emerald-600 font-medium flex items-center gap-1.5 animate-in fade-in duration-300">
                        <CheckCircle2 className="h-4 w-4" /> Kata sandi berhasil diubah
                      </p>
                    )}
                  </div>
                  <Button 
                    type="submit" 
                    variant="outline"
                    disabled={isSavingPassword || !newPassword || !confirmPassword}
                    className="min-w-[140px] border-slate-300"
                  >
                    {isSavingPassword ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Memproses...
                      </>
                    ) : (
                      <>
                        Ganti Kata Sandi
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Status Card */}
        <div className="space-y-6">
          <Card className="border-border/40 shadow-sm bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Status & Peran Akun
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Status Akun</p>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-wider">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  {profile?.status || "AKTIF"}
                </div>
              </div>
              
              <div className="pt-4 border-t border-border/50">
                <p className="text-xs text-muted-foreground mb-2">Tingkat Hak Akses (Role)</p>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-primary/10 text-primary text-sm font-bold uppercase tracking-wider">
                  {primaryRole.replace('_', ' ')}
                </div>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Akun Anda saat ini memiliki akses otorisasi sebagai <strong>{primaryRole.replace('_', ' ')}</strong> di sistem YPIA.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
