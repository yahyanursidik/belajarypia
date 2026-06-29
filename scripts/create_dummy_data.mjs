/**
 * Script: Buat Data Dummy LMS via Supabase Admin API
 * 
 * Cara pakai:
 *   node scripts/create_dummy_data.mjs YOUR_SERVICE_ROLE_KEY
 * 
 * Script ini akan:
 * 1. Menghapus semua user dummy lama (@lms.local & pesertakhusus)
 * 2. Membuat user baru via Admin API (password dijamin bisa login)
 * 3. Menyiapkan profiles, roles, participants, enrollments, dsb.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://foauntgtmhnhqlspgtoc.supabase.co';
const SERVICE_ROLE_KEY = process.argv[2];

if (!SERVICE_ROLE_KEY) {
  console.error('❌ Gunakan: node scripts/create_dummy_data.mjs YOUR_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// ── Daftar User Dummy ──────────────────────────────────────────────
const USERS = [
  { email: 'teacher@lmsypia.com',  password: 'password123', name: 'Ust. Pengajar',       role: 'teacher',     phone: '628222222222' },
  { email: 'mentor@lmsypia.com',   password: 'password123', name: 'Ust. Musyrif',        role: 'mentor',      phone: '628333333333' },
  { email: 'student1@lmsypia.com', password: 'password123', name: 'Ahmad Dzulqarnain',   role: 'participant', phone: '628444444441', gender: 'Laki-laki', city: 'Jakarta Selatan', education: 'S1' },
  { email: 'student2@lmsypia.com', password: 'password123', name: 'Budi Santoso',        role: 'participant', phone: '628444444442', gender: 'Laki-laki', city: 'Depok',           education: 'SMA' },
  { email: 'student3@lmsypia.com', password: 'password123', name: 'Siti Aisyah',         role: 'participant', phone: '628444444443', gender: 'Perempuan', city: 'Tangerang',       education: 'S2' },
  { email: 'student4@lmsypia.com', password: 'password123', name: 'Fatimah Az-Zahra',    role: 'participant', phone: '628444444444', gender: 'Perempuan', city: 'Bogor',           education: 'S1' },
  { email: 'student5@lmsypia.com', password: 'password123', name: 'Zaid bin Haritsah',   role: 'participant', phone: '628444444445', gender: 'Laki-laki', city: 'Bekasi',          education: 'SMA' },
  { email: 'guardian@lmsypia.com', password: 'password123', name: 'Bapak Fulan',         role: 'guardian',    phone: '628555555555' },
];

// ── Fungsi Utama ───────────────────────────────────────────────────
async function main() {
  console.log('🚀 Memulai pembuatan data dummy...\n');

  // 1. Hapus user dummy lama
  console.log('🧹 Membersihkan data lama...');
  const { data: oldUsers } = await supabase.auth.admin.listUsers({ perPage: 100 });
  if (oldUsers?.users) {
    for (const u of oldUsers.users) {
      if (u.email?.endsWith('@lms.local') || u.email === 'pesertakhusus@lmsypia.com') {
        // Hapus data terkait di public schema dulu
        await supabase.from('enrollments').delete().eq('participant_id', 
          (await supabase.from('participants').select('id').eq('user_id', u.id).single())?.data?.id || '00000000-0000-0000-0000-000000000000'
        );
        await supabase.from('participants').delete().eq('user_id', u.id);
        await supabase.from('user_roles').delete().eq('user_id', u.id);
        await supabase.from('profiles').delete().eq('id', u.id);
        
        const { error } = await supabase.auth.admin.deleteUser(u.id);
        if (!error) console.log(`   ✓ Dihapus: ${u.email}`);
      }
    }
  }

  // 2. Buat user baru via Admin API
  console.log('\n👤 Membuat akun baru...');
  const createdUsers = [];
  
  for (const user of USERS) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      phone: user.phone,
      user_metadata: { full_name: user.name }
    });

    if (error) {
      console.error(`   ✗ Gagal membuat ${user.email}: ${error.message}`);
      continue;
    }

    console.log(`   ✓ ${user.email} (${user.name})`);
    createdUsers.push({ ...user, id: data.user.id });
  }

  // 3. Update profiles (biasanya auto-created oleh trigger)
  console.log('\n📋 Mengupdate profil...');
  for (const user of createdUsers) {
    await supabase.from('profiles').upsert({
      id: user.id,
      full_name: user.name,
      email: user.email,
      phone: user.phone,
    }, { onConflict: 'id' });
    console.log(`   ✓ Profil: ${user.name}`);
  }

  // 4. Assign roles
  console.log('\n🔑 Menambahkan peran (roles)...');
  for (const user of createdUsers) {
    const { data: roleData } = await supabase.from('roles').select('id').eq('code', user.role).single();
    if (roleData) {
      await supabase.from('user_roles').upsert({ user_id: user.id, role_id: roleData.id }, { onConflict: 'user_id,role_id' });
      console.log(`   ✓ ${user.name} → ${user.role}`);
    }
  }

  // 5. Buat data peserta (participants)
  console.log('\n🎓 Mendaftarkan peserta...');
  const students = createdUsers.filter(u => u.role === 'participant');
  let nisCounter = 1;
  
  for (const student of students) {
    const nis = `NIS-2026${String(nisCounter++).padStart(3, '0')}`;
    const { error } = await supabase.from('participants').upsert({
      user_id: student.id,
      global_participant_number: nis,
      display_name: student.name,
      gender: student.gender || 'Laki-laki',
      city: student.city || 'Jakarta',
      education_level: student.education || 'SMA',
      status: 'active',
    }, { onConflict: 'user_id' });
    
    if (!error) console.log(`   ✓ ${student.name} (${nis})`);
    else console.error(`   ✗ ${student.name}: ${error.message}`);
  }

  // 6. Enroll peserta ke program (jika program ada)
  console.log('\n📚 Mendaftarkan ke program...');
  const { data: programs } = await supabase.from('programs').select('id, name').limit(2);
  if (programs && programs.length > 0) {
    for (const student of students) {
      const { data: participant } = await supabase.from('participants').select('id').eq('user_id', student.id).single();
      if (participant) {
        const { data: batches } = await supabase.from('batches').select('id').eq('program_id', programs[0].id).limit(1);
        const { data: classes } = await supabase.from('classes').select('id').eq('program_id', programs[0].id).limit(1);
        const { data: halaqahs } = await supabase.from('halaqahs').select('id').limit(1);
        
        const enrollNum = `REG-2026-${String(nisCounter++).padStart(3, '0')}`;
        await supabase.from('enrollments').insert({
          participant_id: participant.id,
          program_id: programs[0].id,
          batch_id: batches?.[0]?.id || null,
          class_id: classes?.[0]?.id || null,
          halaqah_id: halaqahs?.[0]?.id || null,
          enrollment_number: enrollNum,
          enrollment_status: 'active',
        });
        console.log(`   ✓ ${student.name} → ${programs[0].name}`);
      }
    }
  } else {
    console.log('   ⚠ Tidak ada program. Lewati enrollment.');
  }

  // ── Ringkasan ────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(55));
  console.log('✅ DATA DUMMY BERHASIL DIBUAT!\n');
  console.log('Akun yang bisa login:');
  console.log('─'.repeat(55));
  console.log('Portal Admin:');
  console.log('  admin@ypihsanuladab.or.id  (sandi Anda yang lama)');
  console.log('');
  console.log('Portal Peserta (Learner):');
  for (const u of createdUsers.filter(u => u.role === 'participant')) {
    console.log(`  ${u.email}  /  ${u.password}`);
  }
  console.log('');
  console.log('Portal Pengajar (Teacher):');
  for (const u of createdUsers.filter(u => u.role === 'teacher' || u.role === 'mentor')) {
    console.log(`  ${u.email}  /  ${u.password}`);
  }
  console.log('═'.repeat(55));
}

main().catch(console.error);
