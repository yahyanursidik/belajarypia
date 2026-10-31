import { useState } from 'react';
import { Dialog } from '../ui/dialog';
import { WizardSteps } from '../ui/wizard-steps';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { supabase } from '../../lib/supabase';
import { emptyParticipantInput, participantPayload, participantSaveResult, validateParticipant, type ParticipantInput, type ParticipantProgram } from '../../lib/participantDirectory';

export function ParticipantCreateDialog({ programs, onClose, onSaved }: { programs: ParticipantProgram[]; onClose: () => void; onSaved: (id?: string, message?: string) => void }) {
  const [input, setInput] = useState<ParticipantInput>({ ...emptyParticipantInput });
  const [step, setStep] = useState(0); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const field = (key: keyof ParticipantInput) => ({ value: input[key], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setInput((current) => ({ ...current, [key]: e.target.value })) });
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError('');
    if (step === 0 && !input.name.trim()) { setError('Nama wajib diisi.'); return; }
    if (step < 2) { setStep(step + 1); return; }
    const errors = validateParticipant(input, programs); if (errors.length) { setError(errors.join('. ')); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('admin_create_participant_with_user', participantPayload(input));
      if (error) throw error;
      const result = participantSaveResult(data);
      onSaved(result.participantId, result.message);
    } catch (error) { setError(error instanceof Error ? error.message : (error as {message?:string})?.message ?? 'Peserta belum tersimpan. Coba lagi.'); }
    finally { setBusy(false); }
  }
  return <Dialog title="Tambah peserta" busy={busy} onClose={onClose}>
    <WizardSteps steps={['Profil','Akun & program','Tinjau']} current={step} />
    {error && <p role="alert" className="participants-error">{error}</p>}
    <form onSubmit={(e) => void submit(e)} className="space-y-5" onInvalidCapture={(event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement) target.setCustomValidity(target.type === 'email' ? 'Masukkan alamat email yang valid.' : target.type === 'password' ? 'Kata sandi minimal 6 karakter.' : 'Lengkapi kolom ini.');
    }} onInputCapture={(event) => { if (event.target instanceof HTMLInputElement) event.target.setCustomValidity(''); }}>
      <fieldset hidden={step !== 0} disabled={step !== 0 || busy} className="participant-form-grid">
        <label>Nama lengkap<Input required {...field('name')} autoComplete="name" /></label>
        <label>Nomor induk<Input {...field('nis')} placeholder="Otomatis jika dikosongkan" /></label>
        <label>Jenis kelamin<select className="field-control" {...field('gender')}><option>Laki-laki</option><option>Perempuan</option></select></label>
        <label>Tipe peserta<select className="field-control" {...field('participantType')}><option value="adult">Dewasa</option><option value="child">Anak</option></select></label>
        <label>No. WhatsApp<Input type="tel" {...field('phone')} autoComplete="tel" /></label>
        <label>Kota<Input {...field('city')} autoComplete="address-level2" /></label>
        <label>Pendidikan<select className="field-control" {...field('education')}><option value="">Belum diisi</option>{['SD','SMP','SMA','D3','S1','S2','S3'].map((v) => <option key={v}>{v}</option>)}</select></label>
      </fieldset>
      <fieldset hidden={step !== 1} disabled={step !== 1 || busy} className="space-y-5 participant-form-grid">
        <label>Email<Input required type="email" {...field('email')} autoComplete="off" /></label>
        <label>Kata sandi awal<Input required type="password" minLength={6} {...field('password')} autoComplete="new-password" placeholder="Minimal 6 karakter" /></label>
        <label className="participant-form-wide">Program<select className="field-control" {...field('programCode')}><option value="">Tentukan nanti</option>{programs.filter((p) => p.status === 'active').map((p) => <option key={p.id} value={p.code}>{p.name} · {p.code}</option>)}</select></label>
        <p className="participant-form-wide text-xs text-muted-foreground">Akun yang sudah terdaftar tetap memakai sandi semula.</p>
      </fieldset>
      {step === 2 && <section className="program-review"><h3>Periksa peserta</h3><dl><div><dt>Nama</dt><dd>{input.name}</dd></div><div><dt>Email</dt><dd>{input.email.trim().toLowerCase()}</dd></div><div><dt>Program</dt><dd>{programs.find((p) => p.code === input.programCode)?.name ?? 'Ditentukan nanti'}</dd></div><div><dt>Nomor induk</dt><dd>{input.nis || 'Otomatis'}</dd></div><div><dt>Tipe</dt><dd>{input.participantType === 'child' ? 'Anak · wali ditautkan di detail peserta' : 'Dewasa'}</dd></div></dl></section>}
      <div className="wizard-footer"><Button type="button" variant="outline" disabled={busy} onClick={() => step ? setStep(step - 1) : onClose()}>{step ? 'Kembali' : 'Batal'}</Button><span className="text-xs text-muted-foreground">{step + 1} dari 3</span><Button disabled={busy} type="submit">{busy ? 'Menyimpan…' : step === 2 ? 'Simpan peserta' : 'Lanjut'}</Button></div>
    </form>
  </Dialog>;
}
