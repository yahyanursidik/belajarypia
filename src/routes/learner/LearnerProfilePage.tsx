import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { supabase } from "../../lib/supabase";
import { User, Phone, MapPin, GraduationCap, Calendar, Hash, BadgeCheck, AlertCircle, Edit, Save, Loader2, LogOut } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";

type LearnerProfile = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  participant: {
    global_participant_number: string | null;
    display_name: string | null;
    gender: string | null;
    participant_type: string | null;
    city: string | null;
    education_level: string | null;
    birth_date: string | null;
    status: string | null;
  } | null;
};

export function LearnerProfilePage() {
  const { session, signOut } = useAuthSession();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    display_name: "",
    gender: "",
    city: "",
    education_level: "",
    birth_date: "",
  });

  useEffect(() => {
    async function fetchProfile() {
      if (!session?.user?.id) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select(`
            full_name, 
            email, 
            phone,
            participant:participants (
              global_participant_number,
              display_name,
              gender,
              participant_type,
              city,
              education_level,
              birth_date,
              status
            )
          `)
          .eq("id", session.user.id)
          .single();

        if (error) throw error;

        const formattedData: LearnerProfile = {
          full_name: data.full_name,
          email: data.email,
          phone: data.phone,
          participant: Array.isArray(data.participant) ? data.participant[0] : data.participant
        };

        setProfile(formattedData);
        
        // Initialize form data
        setFormData({
          full_name: formattedData.full_name || "",
          phone: formattedData.phone || "",
          display_name: formattedData.participant?.display_name || "",
          gender: formattedData.participant?.gender || "",
          city: formattedData.participant?.city || "",
          education_level: formattedData.participant?.education_level || "",
          birth_date: formattedData.participant?.birth_date || "",
        });
      } catch (err: any) {
        console.error("Error fetching profile:", err);
        setError("Gagal memuat profil. Silakan coba lagi.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchProfile();
  }, [session?.user?.id]);

  const handleSave = async () => {
    if (!session?.user?.id) return;
    
    setIsSaving(true);
    setSaveFeedback(null);
    
    try {
      // 1. Update profiles table
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
        })
        .eq("id", session.user.id);

      if (profileError) throw profileError;

      // 2. Update participants table
      const { error: participantError } = await supabase
        .from("participants")
        .update({
          display_name: formData.display_name,
          gender: formData.gender,
          city: formData.city,
          education_level: formData.education_level,
          birth_date: formData.birth_date || null,
        })
        .eq("user_id", session.user.id);

      if (participantError) throw participantError;

      // 3. Update local state
      if (profile) {
        setProfile({
          ...profile,
          full_name: formData.full_name,
          phone: formData.phone,
          participant: profile.participant ? {
            ...profile.participant,
            display_name: formData.display_name,
            gender: formData.gender,
            city: formData.city,
            education_level: formData.education_level,
            birth_date: formData.birth_date,
          } : null
        });
      }

      setSaveFeedback({ message: "Profil berhasil diperbarui!", type: "success" });
      setIsEditing(false);
      
      // Auto-hide feedback
      setTimeout(() => setSaveFeedback(null), 3000);
    } catch (err: any) {
      setSaveFeedback({ message: "Gagal menyimpan: " + err.message, type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form data to current profile data
    if (profile) {
      setFormData({
        full_name: profile.full_name || "",
        phone: profile.phone || "",
        display_name: profile.participant?.display_name || "",
        gender: profile.participant?.gender || "",
        city: profile.participant?.city || "",
        education_level: profile.participant?.education_level || "",
        birth_date: profile.participant?.birth_date || "",
      });
    }
    setIsEditing(false);
    setSaveFeedback(null);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <p>{error || "Data profil tidak ditemukan."}</p>
        </div>
      </div>
    );
  }

  const { participant } = profile;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Profil Saya</h1>
          <p className="text-gray-500 mt-2">Informasi data diri dan akademik Anda yang terdaftar di sistem.</p>
        </div>
        
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)} className="gap-2">
            <Edit className="w-4 h-4" /> Ubah Profil
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
              Batal
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Simpan
            </Button>
          </div>
        )}
      </div>

      {saveFeedback && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${saveFeedback.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {saveFeedback.type === 'success' ? <BadgeCheck className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <p>{saveFeedback.message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Kolom Kiri - Info Utama */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
            <div className="w-24 h-24 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-12 h-12" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">{profile.full_name || "-"}</h2>
            <p className="text-sm text-gray-500 mb-4">{profile.email || "-"}</p>
            
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-50 text-green-700">
              <BadgeCheck className="w-4 h-4" />
              {participant?.status === 'active' ? 'Aktif' : participant?.status || 'Tidak Diketahui'}
            </div>
          </div>
          
          <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Email & NIS Permanen</p>
              <p className="text-blue-700/80">Alamat email dan Nomor Induk (NIS) tidak dapat diubah secara mandiri. Silakan hubungi Administrator jika ada kesalahan.</p>
            </div>
          </div>
        </div>

        {/* Kolom Kanan - Detail Info */}
        <div className="md:col-span-2 space-y-6">
          {/* Kartu Info Akun */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="border-b border-gray-100 px-6 py-4 bg-gray-50/50">
              <h3 className="font-semibold text-gray-900">Informasi Kontak & Akun</h3>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm text-gray-500 flex items-center gap-2">
                  <User className="w-4 h-4" /> Nama Lengkap Sesuai KTP
                </label>
                {isEditing ? (
                  <Input 
                    value={formData.full_name} 
                    onChange={e => setFormData({...formData, full_name: e.target.value})} 
                    placeholder="Nama Lengkap"
                  />
                ) : (
                  <p className="font-medium text-gray-900">{profile.full_name || "-"}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-500 flex items-center gap-2">
                  <User className="w-4 h-4" /> Nama Panggilan (Tampilan)
                </label>
                {isEditing ? (
                  <Input 
                    value={formData.display_name} 
                    onChange={e => setFormData({...formData, display_name: e.target.value})} 
                    placeholder="Nama Panggilan"
                  />
                ) : (
                  <p className="font-medium text-gray-900">{participant?.display_name || "-"}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-500 flex items-center gap-2">
                  <Phone className="w-4 h-4" /> No. Telepon / WhatsApp
                </label>
                {isEditing ? (
                  <Input 
                    value={formData.phone} 
                    onChange={e => setFormData({...formData, phone: e.target.value})} 
                    placeholder="Contoh: 62812345678"
                  />
                ) : (
                  <p className="font-medium text-gray-900">{profile.phone || "-"}</p>
                )}
              </div>
            </div>
          </div>

          {/* Kartu Info Akademik */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="border-b border-gray-100 px-6 py-4 bg-gray-50/50">
              <h3 className="font-semibold text-gray-900">Informasi Akademik & Demografi</h3>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm text-gray-500 flex items-center gap-2">
                  <Hash className="w-4 h-4" /> NIS (Nomor Induk)
                </label>
                <Input disabled value={participant?.global_participant_number || "-"} className="bg-gray-50 text-gray-500" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-500 flex items-center gap-2">
                  <User className="w-4 h-4" /> Jenis Kelamin
                </label>
                {isEditing ? (
                  <select 
                    value={formData.gender} 
                    onChange={e => setFormData({...formData, gender: e.target.value})}
                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Pilih Jenis Kelamin</option>
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                ) : (
                  <p className="font-medium text-gray-900">{participant?.gender || "-"}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-500 flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Domisili / Kota Asal
                </label>
                {isEditing ? (
                  <Input 
                    value={formData.city} 
                    onChange={e => setFormData({...formData, city: e.target.value})} 
                    placeholder="Contoh: Jakarta Selatan"
                  />
                ) : (
                  <p className="font-medium text-gray-900">{participant?.city || "-"}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-500 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Tanggal Lahir
                </label>
                {isEditing ? (
                  <Input 
                    type="date"
                    value={formData.birth_date} 
                    onChange={e => setFormData({...formData, birth_date: e.target.value})} 
                  />
                ) : (
                  <p className="font-medium text-gray-900">{participant?.birth_date || "-"}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-500 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4" /> Pendidikan Terakhir
                </label>
                {isEditing ? (
                  <select 
                    value={formData.education_level} 
                    onChange={e => setFormData({...formData, education_level: e.target.value})}
                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Pilih Pendidikan</option>
                    <option value="SD">SD</option>
                    <option value="SMP">SMP</option>
                    <option value="SMA">SMA / Sederajat</option>
                    <option value="D3">Diploma (D3)</option>
                    <option value="S1">Sarjana (S1)</option>
                    <option value="S2">Magister (S2)</option>
                    <option value="S3">Doktor (S3)</option>
                  </select>
                ) : (
                  <p className="font-medium text-gray-900">{participant?.education_level || "-"}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-500 flex items-center gap-2">
                  <User className="w-4 h-4" /> Kategori Peserta
                </label>
                <Input disabled value={participant?.participant_type === 'adult' ? 'Dewasa' : (participant?.participant_type || 'Reguler')} className="bg-gray-50 text-gray-500 capitalize" />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Tombol Logout untuk Mobile (karena top header disembunyikan di mobile) */}
      <div className="md:hidden pt-8 pb-4">
        <Button 
          variant="outline" 
          className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 bg-white"
          onClick={async () => {
            await signOut();
            navigate("/learner/login", { replace: true });
          }}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Keluar dari Akun (Logout)
        </Button>
      </div>
    </div>
  );
}
