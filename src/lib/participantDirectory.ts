export type ParticipantProgram = { id: string; code: string; name: string; status: string };
export type ParticipantInput = { name: string; email: string; password: string; phone: string; nis: string; gender: string; participantType: string; city: string; education: string; programCode: string };
export const emptyParticipantInput: ParticipantInput = { name: '', email: '', password: '', phone: '', nis: '', gender: 'Laki-laki', participantType: 'adult', city: '', education: '', programCode: '' };
export const csvHeaders = ['Nama Lengkap','No WhatsApp','Email','Password','Kode Program','Nomor Induk','Jenis Kelamin','Tipe Peserta','Kota','Pendidikan'];
export type ImportRow = { line: number; input: ParticipantInput; errors: string[]; result?: 'created' | 'existing' | 'failed'; message?: string; participantId?: string };
export function validateParticipant(input: ParticipantInput, programs: ParticipantProgram[]) {
  const errors: string[] = [];
  if (!input.name.trim()) errors.push('Nama wajib diisi');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) errors.push('Email tidak valid');
  if (input.password.length < 6) errors.push('Kata sandi minimal 6 karakter');
  if (input.programCode && !programs.some((p) => p.code.toLowerCase() === input.programCode.toLowerCase() && p.status === 'active')) errors.push('Program tidak ditemukan atau tidak aktif');
  if (!['Laki-laki','Perempuan'].includes(input.gender)) errors.push('Jenis kelamin tidak valid');
  if (!['adult','child'].includes(input.participantType)) errors.push('Tipe peserta harus adult atau child');
  return errors;
}
export function analyzeParticipants(rows: Record<string, string>[], programs: ParticipantProgram[]): ImportRow[] {
  const emails = new Set<string>(); const numbers = new Set<string>();
  return rows.map((row, index) => {
    const input: ParticipantInput = { name: (row['Nama Lengkap'] ?? '').trim(), phone: (row['No WhatsApp'] ?? '').trim(), email: (row.Email ?? '').trim().toLowerCase(), password: row.Password ?? '', programCode: (row['Kode Program'] ?? '').trim(), nis: (row['Nomor Induk'] ?? '').trim(), gender: row['Jenis Kelamin']?.trim() || 'Laki-laki', participantType: row['Tipe Peserta']?.trim() || 'adult', city: row.Kota?.trim() ?? '', education: row.Pendidikan?.trim() ?? '' };
    const errors = validateParticipant(input, programs);
    if (emails.has(input.email)) errors.push('Email berulang dalam file');
    if (input.nis && numbers.has(input.nis)) errors.push('Nomor induk berulang dalam file');
    emails.add(input.email); if (input.nis) numbers.add(input.nis);
    return { line: index + 2, input, errors };
  });
}
export function participantPayload(input: ParticipantInput) {
  return { p_email: input.email.trim().toLowerCase(), p_password: input.password, p_display_name: input.name.trim(), p_phone: input.phone.trim(), p_nis: input.nis.trim() || `NIS-${crypto.randomUUID()}`, p_gender: input.gender, p_participant_type: input.participantType, p_city: input.city.trim(), p_education: input.education, p_program_code: input.programCode || null };
}
export function safeParticipantSearch(query: string) { return query.replace(/[,()%*"\\]/g, ' ').replace(/\s+/g,' ').trim(); }

export function participantPage(value: string | null) { const page=Number(value);return Number.isSafeInteger(page) && page>=1 ? page : 1; }

export function participantSaveResult(data: unknown) {
  const result = data as { participant_id?: unknown; status?: string; enrollment_action?: string } | null;
  if (!result || typeof result.participant_id !== 'string' || !result.participant_id) {
    throw new Error('Server belum mengonfirmasi peserta tersimpan.');
  }
  const existing = result.status === 'enrolled_existing';
  const message = result.enrollment_action === 'unchanged'
    ? 'Tersimpan · enrollment dan penempatan lama dipertahankan'
    : result.enrollment_action === 'created' ? 'Tersimpan · program ditambahkan'
    : existing ? 'Tersimpan · akun lama digunakan' : 'Peserta tersimpan';
  return { participantId: result.participant_id, existing, message };
}
