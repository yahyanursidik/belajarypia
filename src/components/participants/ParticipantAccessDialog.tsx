import { useState } from 'react';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { supabase } from '../../lib/supabase';
export function ParticipantAccessDialog({ participant, onClose }: { participant: { user_id: string | null; display_name: string }; onClose: () => void }) {
  const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [saved, setSaved] = useState(false);
  return <Dialog title="Akses akun peserta" busy={busy} onClose={onClose}>
    <p className="mb-5 font-medium">{participant.display_name}</p>
    {!participant.user_id ? <p>Akun login belum terhubung. Periksa akun pengguna sebelum mengganti sandi.</p> : saved ? <div role="status" className="space-y-4"><p>Kata sandi berhasil diperbarui.</p><Button onClick={onClose}>Selesai</Button></div> : <form className="space-y-5" onSubmit={async (e) => {
      e.preventDefault(); setError(''); setBusy(true);
      try { const { error } = await supabase.rpc('admin_reset_user_password', { target_user_id: participant.user_id, new_password: password }); if (error) throw error; setPassword(''); setSaved(true); }
      catch (error) { setError((error as {message?:string})?.message ?? 'Sandi belum dapat diperbarui.'); }
      finally { setBusy(false); }
    }}>
      <label className="block space-y-2">Kata sandi baru<Input type="password" autoComplete="new-password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} placeholder="Minimal 6 karakter" /></label>
      {error && <p role="alert" className="participants-error">{error}</p>}
      <div className="wizard-footer"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Batal</Button><Button type="submit" disabled={busy || password.length < 6}>{busy ? 'Menyimpan…' : 'Ganti kata sandi'}</Button></div>
    </form>}
  </Dialog>;
}
