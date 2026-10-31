import { Link } from "react-router-dom";
import { useState } from 'react';
import Papa from 'papaparse';
import { Dialog } from '../ui/dialog';
import { WizardSteps } from '../ui/wizard-steps';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Progress } from '../ui/progress';
import { supabase } from '../../lib/supabase';
import { analyzeParticipants, csvHeaders, participantPayload, participantSaveResult, type ImportRow, type ParticipantProgram } from '../../lib/participantDirectory';

function downloadCsv(name: string, rows: string[][]) {
  const url = URL.createObjectURL(new Blob(['\uFEFF' + Papa.unparse(rows, { escapeFormulae: true })], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
}
export function ParticipantImportDialog({ programs, onClose, onSaved, basePath }: { basePath: string; programs: ParticipantProgram[]; onClose: () => void; onSaved: () => void }) {
  const [file, setFile] = useState<File | null>(null); const [rows, setRows] = useState<ImportRow[]>([]);
  const [step, setStep] = useState(0); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [processed, setProcessed] = useState(0); const [runTotal, setRunTotal] = useState(0);
  const valid = rows.filter((r) => !r.errors.length); const failed = rows.filter((r) => r.result === 'failed');
  async function analyze() {
    if (!file) return; setError('');
    if (!file.name.toLowerCase().endsWith('.csv') || file.size > 2_000_000) { setError('Gunakan CSV maksimal 2 MB.'); return; }
    setBusy(true);
    Papa.parse<Record<string,string>>(file, { header: true, skipEmptyLines: 'greedy', transformHeader: (header) => header.replace(/^\uFEFF/, '').trim(), complete: (result) => {
      const missing = ['Nama Lengkap','Email','Password'].filter((header) => !result.meta.fields?.includes(header));
      if (missing.length || result.errors.length || !result.data.length || result.data.length > 1000) {
        setError(missing.length ? `Kolom wajib: ${missing.join(', ')}` : result.errors.length ? 'Format CSV belum sesuai. Periksa pemisah dan jumlah kolom.' : 'Isi file harus 1–1.000 baris.');
      } else { setRows(analyzeParticipants(result.data, programs)); setStep(1); }
      setBusy(false);
    }, error: () => { setError('File belum dapat dibaca. Coba pilih ulang.'); setBusy(false); } });
  }
  async function execute() {
    if (busy) return;
    setBusy(true); setError(''); setProcessed(0); setStep(2);
    const next = [...rows]; const targets = next.filter((r) => !r.errors.length && (!r.result || r.result === 'failed')); setRunTotal(targets.length);
    for (const [index, row] of targets.entries()) {
      try {
        const { data, error } = await supabase.rpc('admin_create_participant_with_user', participantPayload(row.input));
        if (error) throw error;
        const result = participantSaveResult(data);
        row.participantId = result.participantId;
        row.result = result.existing ? 'existing' : 'created'; row.message = result.message;
      } catch (error) { row.result = 'failed'; row.message = (error as {message?:string})?.message ?? 'Belum tersimpan'; }
      setRows([...next]); setProcessed(index + 1);
    }
    setStep(3); setBusy(false); onSaved();
  }
  return <Dialog title="Impor peserta" busy={busy} onClose={onClose}>
    <WizardSteps steps={['Unggah','Periksa','Impor','Hasil']} current={step} />
    {error && <p className="participants-error" role="alert">{error}</p>}
    {step === 0 && <div className="space-y-5"><Button variant="outline" onClick={() => downloadCsv('template-peserta.csv', [csvHeaders])}>Unduh template CSV</Button><label className="block space-y-2">File CSV<Input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={busy} /></label><p className="text-xs text-muted-foreground">Nama, email, dan kata sandi wajib. Program boleh ditentukan nanti. Maksimal 1.000 baris.</p><div className="wizard-footer"><Button variant="outline" disabled={busy} onClick={onClose}>Batal</Button><Button disabled={!file || busy} onClick={() => void analyze()}>{busy ? 'Memeriksa…' : 'Periksa file'}</Button></div></div>}
    {(step === 1 || step === 3) && <div className="space-y-4">
      <div className="participant-import-counts"><span>{rows.length} baris</span><span className="text-emerald-700">{step === 1 ? valid.length + ' siap diimpor' : rows.filter((r) => r.result === 'created').length + ' akun baru'}</span><span className="text-sky-700">{step === 3 ? rows.filter((r) => r.result === 'existing').length + ' akun lama' : ''}</span><span className="text-red-700">{rows.filter((r) => r.errors.length || r.result === 'failed').length} perlu diperbaiki</span></div>
      <div className="participant-import-table"><table className="data-table"><thead><tr><th>Baris</th><th>Peserta</th><th>Program</th><th>Status</th></tr></thead><tbody>{rows.map((row) => <tr key={row.line}><td>{row.line}</td><td>{row.participantId ? <Link className="participant-name" to={`${basePath}/peserta/${row.participantId}`}>{row.input.name}</Link> : <strong>{row.input.name || 'Tanpa nama'}</strong>}<br/><span className="text-xs text-muted-foreground">{row.input.email}</span></td><td>{row.input.programCode || 'Nanti'}</td><td className={row.errors.length || row.result === 'failed' ? 'text-red-700' : 'text-emerald-700'}>{row.errors.join('. ') || row.message || 'Siap'}</td></tr>)}</tbody></table></div>
      {(rows.some((r) => r.errors.length) || failed.length > 0) && <Button variant="outline" onClick={() => downloadCsv('hasil-impor-perlu-perbaikan.csv', [['Baris','Nama','Email','Keterangan'], ...rows.filter((r) => r.errors.length || r.result === 'failed').map((r) => [String(r.line),r.input.name,r.input.email,r.errors.join('. ') || r.message || ''])])}>Unduh laporan kesalahan</Button>}
      <div className="wizard-footer"><Button variant="outline" onClick={() => step === 1 ? setStep(0) : onClose()}>{step === 1 ? 'Ganti file' : 'Selesai'}</Button>{step === 1 ? <Button disabled={!valid.length} onClick={() => void execute()}>Impor {valid.length} baris valid</Button> : failed.length > 0 && <Button onClick={() => void execute()}>Coba ulang {failed.length} gagal</Button>}</div>
    </div>}
    {step === 2 && <div className="space-y-5" role="status"><p>Menyimpan peserta… {processed} baris diproses</p><Progress aria-label="Progres impor" value={runTotal ? processed / runTotal * 100 : 0} /></div>}
  </Dialog>;
}
