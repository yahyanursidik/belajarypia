import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';
import type { ParticipantProgram } from '../../lib/participantDirectory';
export function ParticipantProgramPicker({ basePath, participantNumber, existingIds, onClose }: { basePath: string; participantNumber: string; existingIds: string[]; onClose: () => void }) {
  const [programs,setPrograms] = useState<ParticipantProgram[]>([]); const [selected,setSelected] = useState(''); const [error,setError] = useState(''); const [loading,setLoading] = useState(true);
  useEffect(()=>{ const controller=new AbortController(); void supabase.from('programs').select('id,name,code,status').eq('status','active').order('name').abortSignal(controller.signal).then(({data,error})=>{if(controller.signal.aborted)return;if(error)setError('Program belum dapat dimuat.');else setPrograms((data??[]) as ParticipantProgram[]);setLoading(false);});return()=>controller.abort();},[]);
  const available=programs.filter((p)=>!existingIds.includes(p.id));
  return <Dialog title="Pilih program peserta" onClose={onClose}><div className="space-y-5">
    {loading?<p role="status">Memuat program…</p>:error?<p role="alert">{error}</p>:available.length?<label className="block space-y-2">Program aktif<select className="field-control" value={selected} onChange={(e)=>setSelected(e.target.value)}><option value="">Pilih program</option>{available.map((p)=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label>:<p>Belum ada program aktif lain yang dapat dipilih.</p>}
    <p className="text-sm text-muted-foreground">Lanjutkan pemilihan peserta di program tujuan.</p><div className="wizard-footer"><Button variant="outline" onClick={onClose}>Batal</Button>{selected && <Button asChild><Link to={`${basePath}/program/${selected}/peserta?addParticipant=${encodeURIComponent(participantNumber)}`}>Lanjut ke program</Link></Button>}</div>
  </div></Dialog>;
}
