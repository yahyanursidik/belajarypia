-- Dummy Data Seed Script for LMS (Diperbarui dengan Education Level & Data Ekstra)
-- Run this script in the Supabase SQL Editor.

-------------------------------------------------------------------------------
-- 0. SCHEMA UPDATES
-------------------------------------------------------------------------------
alter table public.participants add column if not exists education_level text;

-------------------------------------------------------------------------------
-- 1. AUTH USERS & PROFILES
-------------------------------------------------------------------------------
-- Menambahkan nomor telepon / WhatsApp (phone) untuk pengguna
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, phone)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'admin@lmsypia.com', crypt('password123', gen_salt('bf')), now(), '{"full_name": "Admin Utama"}', now(), now(), '628111111111'),
  ('22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'teacher@lmsypia.com', crypt('password123', gen_salt('bf')), now(), '{"full_name": "Ust. Pengajar"}', now(), now(), '628222222222'),
  ('33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'mentor@lmsypia.com', crypt('password123', gen_salt('bf')), now(), '{"full_name": "Ust. Musyrif"}', now(), now(), '628333333333'),
  ('44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'student1@lmsypia.com', crypt('password123', gen_salt('bf')), now(), '{"full_name": "Ahmad Dzulqarnain"}', now(), now(), '628444444441'),
  ('44444444-4444-4444-4444-444444444445', 'authenticated', 'authenticated', 'student2@lmsypia.com', crypt('password123', gen_salt('bf')), now(), '{"full_name": "Budi Santoso"}', now(), now(), '628444444442'),
  ('44444444-4444-4444-4444-444444444446', 'authenticated', 'authenticated', 'student3@lmsypia.com', crypt('password123', gen_salt('bf')), now(), '{"full_name": "Siti Aisyah"}', now(), now(), '628444444443'),
  ('44444444-4444-4444-4444-444444444447', 'authenticated', 'authenticated', 'student4@lmsypia.com', crypt('password123', gen_salt('bf')), now(), '{"full_name": "Fatimah Az-Zahra"}', now(), now(), '628444444444'),
  ('44444444-4444-4444-4444-444444444448', 'authenticated', 'authenticated', 'student5@lmsypia.com', crypt('password123', gen_salt('bf')), now(), '{"full_name": "Zaid bin Haritsah"}', now(), now(), '628444444445'),
  ('55555555-5555-5555-5555-555555555555', 'authenticated', 'authenticated', 'guardian@lmsypia.com', crypt('password123', gen_salt('bf')), now(), '{"full_name": "Bapak Fulan"}', now(), now(), '628555555555')
ON CONFLICT (id) DO NOTHING;

-- Mengupdate data Phone ke tabel Profiles jika belum tersinkron dengan sempurna
UPDATE public.profiles SET phone = '628111111111' WHERE id = '11111111-1111-1111-1111-111111111111';
UPDATE public.profiles SET phone = '628444444441' WHERE id = '44444444-4444-4444-4444-444444444444';
UPDATE public.profiles SET phone = '628444444442' WHERE id = '44444444-4444-4444-4444-444444444445';
UPDATE public.profiles SET phone = '628444444443' WHERE id = '44444444-4444-4444-4444-444444444446';
UPDATE public.profiles SET phone = '628444444444' WHERE id = '44444444-4444-4444-4444-444444444447';
UPDATE public.profiles SET phone = '628444444445' WHERE id = '44444444-4444-4444-4444-444444444448';

DO $$
DECLARE
  role_admin_id uuid;
  role_teacher_id uuid;
  role_mentor_id uuid;
  role_participant_id uuid;
  role_guardian_id uuid;
BEGIN
  SELECT id INTO role_admin_id FROM public.roles WHERE code = 'admin';
  SELECT id INTO role_teacher_id FROM public.roles WHERE code = 'teacher';
  SELECT id INTO role_mentor_id FROM public.roles WHERE code = 'mentor';
  SELECT id INTO role_participant_id FROM public.roles WHERE code = 'participant';
  SELECT id INTO role_guardian_id FROM public.roles WHERE code = 'guardian';

  INSERT INTO public.user_roles (user_id, role_id) VALUES ('11111111-1111-1111-1111-111111111111', role_admin_id) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role_id) VALUES ('22222222-2222-2222-2222-222222222222', role_teacher_id) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role_id) VALUES ('33333333-3333-3333-3333-333333333333', role_mentor_id) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role_id) VALUES ('44444444-4444-4444-4444-444444444444', role_participant_id) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role_id) VALUES ('44444444-4444-4444-4444-444444444445', role_participant_id) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role_id) VALUES ('44444444-4444-4444-4444-444444444446', role_participant_id) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role_id) VALUES ('44444444-4444-4444-4444-444444444447', role_participant_id) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role_id) VALUES ('44444444-4444-4444-4444-444444444448', role_participant_id) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role_id) VALUES ('55555555-5555-5555-5555-555555555555', role_guardian_id) ON CONFLICT DO NOTHING;
END $$;

-------------------------------------------------------------------------------
-- 2. ORGANIZATION, UNITS, PROGRAMS
-------------------------------------------------------------------------------
INSERT INTO public.organizations (id, name, status) 
VALUES ('11111111-0000-0000-0000-000000000000', 'Yayasan Pendidikan Ihsanul Adab', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.units (id, organization_id, code, name)
VALUES ('22222222-0000-0000-0000-000000000000', '11111111-0000-0000-0000-000000000000', 'UNIT-01', 'Akademi Bahasa & Al-Quran')
ON CONFLICT (id) DO NOTHING;

-- Program 1
INSERT INTO public.programs (id, unit_id, code, name, status)
VALUES ('33333333-0000-0000-0000-000000000000', '22222222-0000-0000-0000-000000000000', 'PROG-01', 'Program Bimbingan Islam Reguler', 'active')
ON CONFLICT (id) DO NOTHING;

-- Program 2
INSERT INTO public.programs (id, unit_id, code, name, status)
VALUES ('33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000000', 'PROG-02', 'Tahsin & Tahfiz Quran Intensif', 'active')
ON CONFLICT (id) DO NOTHING;

-------------------------------------------------------------------------------
-- 3. BATCHES, CLASSES, HALAQAHS
-------------------------------------------------------------------------------
-- Batches for Program 1
INSERT INTO public.batches (id, program_id, code, name, status)
VALUES ('44444444-0000-0000-0000-000000000000', '33333333-0000-0000-0000-000000000000', 'BATCH-01', 'Angkatan 1 - 2026', 'active')
ON CONFLICT (id) DO NOTHING;

-- Batches for Program 2
INSERT INTO public.batches (id, program_id, code, name, status)
VALUES ('44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'BATCH-01-TQ', 'Angkatan 1 - Tahsin', 'active')
ON CONFLICT (id) DO NOTHING;

-- Classes
INSERT INTO public.classes (id, program_id, batch_id, code, name, teacher_user_id, status)
VALUES 
  ('55555555-0000-0000-0000-000000000000', '33333333-0000-0000-0000-000000000000', '44444444-0000-0000-0000-000000000000', 'CLS-01', 'Kelas Reguler A (Ikhwan)', '22222222-2222-2222-2222-222222222222', 'active'),
  ('55555555-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000001', 'CLS-02', 'Kelas Tahsin Reguler', '22222222-2222-2222-2222-222222222222', 'active')
ON CONFLICT (id) DO NOTHING;

-- Halaqahs
INSERT INTO public.halaqahs (id, class_id, code, name, mentor_user_id, status)
VALUES 
  ('66666666-0000-0000-0000-000000000000', '55555555-0000-0000-0000-000000000000', 'HLQ-01', 'Halaqah Abu Bakar', '33333333-3333-3333-3333-333333333333', 'active'),
  ('66666666-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001', 'HLQ-02', 'Halaqah Utsman', '33333333-3333-3333-3333-333333333333', 'active')
ON CONFLICT (id) DO NOTHING;

-------------------------------------------------------------------------------
-- 4. PARTICIPANT & GUARDIAN
-------------------------------------------------------------------------------
INSERT INTO public.participants (id, user_id, global_participant_number, display_name, gender, city, education_level, status)
VALUES 
  ('77777777-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444', 'NIS-2026001', 'Ahmad Dzulqarnain', 'Laki-laki', 'Jakarta Selatan', 'S1', 'active'),
  ('77777777-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444445', 'NIS-2026002', 'Budi Santoso', 'Laki-laki', 'Depok', 'SMA', 'active'),
  ('77777777-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444446', 'NIS-2026003', 'Siti Aisyah', 'Perempuan', 'Tangerang', 'S2', 'active'),
  ('77777777-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444447', 'NIS-2026004', 'Fatimah Az-Zahra', 'Perempuan', 'Bogor', 'S1', 'active'),
  ('77777777-0000-0000-0000-000000000004', '44444444-4444-4444-4444-444444444448', 'NIS-2026005', 'Zaid bin Haritsah', 'Laki-laki', 'Bekasi', 'SMA', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.guardians (id, user_id, relation_type)
VALUES ('88888888-0000-0000-0000-000000000000', '55555555-5555-5555-5555-555555555555', 'Ayah')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.guardian_participants (guardian_id, participant_id, is_primary)
VALUES 
  ('88888888-0000-0000-0000-000000000000', '77777777-0000-0000-0000-000000000000', true),
  ('88888888-0000-0000-0000-000000000000', '77777777-0000-0000-0000-000000000001', false)
ON CONFLICT DO NOTHING;

-------------------------------------------------------------------------------
-- 5. ENROLLMENTS
-------------------------------------------------------------------------------
INSERT INTO public.enrollments (id, participant_id, program_id, batch_id, class_id, halaqah_id, enrollment_number, enrollment_status)
VALUES 
  -- Ahmad (Program 1 & 2)
  ('99999999-0000-0000-0000-000000000000', '77777777-0000-0000-0000-000000000000', '33333333-0000-0000-0000-000000000000', '44444444-0000-0000-0000-000000000000', '55555555-0000-0000-0000-000000000000', '66666666-0000-0000-0000-000000000000', 'REG-2026-001', 'active'),
  ('99999999-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000000', '33333333-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001', '66666666-0000-0000-0000-000000000001', 'THS-2026-001', 'active'),
  -- Budi (Program 1)
  ('99999999-0000-0000-0000-000000000002', '77777777-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000000', '44444444-0000-0000-0000-000000000000', '55555555-0000-0000-0000-000000000000', '66666666-0000-0000-0000-000000000000', 'REG-2026-002', 'active'),
  -- Siti (Program 2)
  ('99999999-0000-0000-0000-000000000003', '77777777-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001', '66666666-0000-0000-0000-000000000001', 'THS-2026-002', 'active'),
  -- Fatimah (Program 1)
  ('99999999-0000-0000-0000-000000000004', '77777777-0000-0000-0000-000000000003', '33333333-0000-0000-0000-000000000000', '44444444-0000-0000-0000-000000000000', '55555555-0000-0000-0000-000000000000', '66666666-0000-0000-0000-000000000000', 'REG-2026-003', 'active'),
  -- Zaid (Program 1 & 2)
  ('99999999-0000-0000-0000-000000000005', '77777777-0000-0000-0000-000000000004', '33333333-0000-0000-0000-000000000000', '44444444-0000-0000-0000-000000000000', '55555555-0000-0000-0000-000000000000', '66666666-0000-0000-0000-000000000000', 'REG-2026-004', 'active'),
  ('99999999-0000-0000-0000-000000000006', '77777777-0000-0000-0000-000000000004', '33333333-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001', '66666666-0000-0000-0000-000000000001', 'THS-2026-004', 'active')
ON CONFLICT (id) DO NOTHING;

-------------------------------------------------------------------------------
-- 6. QUESTION BANKS & ITEMS
-------------------------------------------------------------------------------
INSERT INTO public.question_banks (id, program_id, name, description)
VALUES ('aaaaaaaa-0000-0000-0000-000000000000', '33333333-0000-0000-0000-000000000000', 'Bank Soal Fikih Dasar', 'Kumpulan soal untuk materi fikih ibadah.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.question_bank_items (id, question_bank_id, question_type, question_text, options, correct_answer, explanation)
VALUES 
  ('bbbbbbbb-1111-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'multiple_choice', 'Berapakah jumlah rakaat shalat Subuh?', '["1", "2", "3", "4"]'::jsonb, '2', 'Shalat Subuh terdiri dari 2 rakaat.'),
  ('bbbbbbbb-2222-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'multiple_choice', 'Puasa wajib bagi umat Islam dilaksanakan pada bulan?', '["Rajab", "Sya''ban", "Ramadhan", "Syawal"]'::jsonb, 'Ramadhan', 'Puasa Ramadhan adalah rukun Islam yang ketiga.')
ON CONFLICT (id) DO NOTHING;

-------------------------------------------------------------------------------
-- 7. PROGRAM MODULES & LESSONS / QUIZZES
-------------------------------------------------------------------------------
INSERT INTO public.program_modules (id, program_id, code, title, module_type, order_no, is_required)
VALUES ('cccccccc-0000-0000-0000-000000000000', '33333333-0000-0000-0000-000000000000', 'MOD-01', 'Semester 1: Fikih Ibadah', 'chapter', 1, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.lessons (id, module_id, code, title, lesson_type, content_body, order_no, visibility_status)
VALUES ('dddddddd-1111-0000-0000-000000000000', 'cccccccc-0000-0000-0000-000000000000', 'LSN-01', 'Pengantar Fikih Thaharah', 'materi', 'Berikut adalah materi dasar tentang thaharah (bersuci)...', 1, 'published')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.lessons (id, module_id, code, title, lesson_type, content_body, order_no, visibility_status)
VALUES ('dddddddd-2222-0000-0000-000000000000', 'cccccccc-0000-0000-0000-000000000000', 'QZ-01', 'Kuis Harian 1: Thaharah', 'kuis', 'Kerjakan soal-soal berikut dengan teliti.', 2, 'published')
ON CONFLICT (id) DO NOTHING;

-------------------------------------------------------------------------------
-- 8. QUIZ QUESTIONS
-------------------------------------------------------------------------------
INSERT INTO public.quiz_questions (id, lesson_id, question_type, question_text, options, correct_answer, explanation, order_no)
VALUES ('eeeeeeee-1111-0000-0000-000000000000', 'dddddddd-2222-0000-0000-000000000000', 'multiple_choice', 'Air yang suci dan menyucikan disebut?', '["Air Mutlaq", "Air Musta''mal", "Air Mutanajjis", "Air Musyammas"]'::jsonb, 'Air Mutlaq', 'Air mutlaq adalah air yang murni dan belum berubah sifatnya.', 1)
ON CONFLICT (id) DO NOTHING;

-------------------------------------------------------------------------------
-- 9. HELPDESK
-------------------------------------------------------------------------------
INSERT INTO public.helpdesk_tickets (id, ticket_number, reporter_id, category, subject, priority, status, assigned_to)
VALUES 
  ('ffffffff-1111-0000-0000-000000000000', 'TKT-000001', '44444444-4444-4444-4444-444444444444', 'technical', 'Gagal mengakses halaman materi', 'high', 'open', NULL),
  ('ffffffff-2222-0000-0000-000000000000', 'TKT-000002', '44444444-4444-4444-4444-444444444445', 'academic', 'Pertanyaan seputar quiz fikih', 'medium', 'in_progress', '11111111-1111-1111-1111-111111111111'),
  ('ffffffff-3333-0000-0000-000000000000', 'TKT-000003', '44444444-4444-4444-4444-444444444446', 'finance', 'Konfirmasi pembayaran SPP tertunda', 'urgent', 'resolved', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.helpdesk_messages (id, ticket_id, sender_id, message_body, is_internal_note)
VALUES
  ('eeeeeeee-1111-1111-0000-000000000000', 'ffffffff-1111-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444', 'Assalamu alaikum, saya tidak bisa membuka materi pertama, muncul error 404.', false),
  ('eeeeeeee-2222-2222-0000-000000000000', 'ffffffff-2222-0000-0000-000000000000', '44444444-4444-4444-4444-444444444445', 'Ust, untuk pertanyaan no 2 apakah ada toleransi jawaban salah?', false),
  ('eeeeeeee-2222-3333-0000-000000000000', 'ffffffff-2222-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'Wa alaikum salam. Tidak ada toleransi ya akhi, jawaban harus mutlak.', false),
  ('eeeeeeee-3333-1111-0000-000000000000', 'ffffffff-3333-0000-0000-000000000000', '44444444-4444-4444-4444-444444444446', 'Saya sudah transfer SPP bulan ini tapi belum diverifikasi.', false),
  ('eeeeeeee-3333-2222-0000-000000000000', 'ffffffff-3333-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'Tolong bagian finance segera dicek mutasi bank.', true),
  ('eeeeeeee-3333-3333-0000-000000000000', 'ffffffff-3333-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'Alhamdulillah sudah kami verifikasi ukhti, jazakillah khairan.', false)
ON CONFLICT (id) DO NOTHING;

-------------------------------------------------------------------------------
-- 10. FINANCE TRANSACTIONS
-------------------------------------------------------------------------------
INSERT INTO public.transactions (id, participant_id, program_id, amount, transaction_type, status, billing_month, notes, created_by)
VALUES
  ('dddddddd-1111-1111-0000-000000000000', '77777777-0000-0000-0000-000000000000', '33333333-0000-0000-0000-000000000000', 150000, 'spp', 'verified', '2026-06-01', 'Pembayaran SPP Juni via BSI', '11111111-1111-1111-1111-111111111111'),
  ('dddddddd-2222-2222-0000-000000000000', '77777777-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000000', 150000, 'spp', 'pending', '2026-06-01', 'Menunggu konfirmasi mutasi', NULL),
  ('dddddddd-3333-3333-0000-000000000000', '77777777-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000001', 200000, 'registration', 'verified', NULL, 'Pendaftaran Tahsin via BCA', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO NOTHING;

-------------------------------------------------------------------------------
-- 11. CERTIFICATES
-------------------------------------------------------------------------------
INSERT INTO public.certificate_templates (id, program_id, name, template_type, status)
VALUES
  ('cccccccc-1111-1111-0000-000000000000', '33333333-0000-0000-0000-000000000000', 'Syahadah Kelulusan Fikih', 'html', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.certificates (id, enrollment_id, certificate_template_id, certificate_number, recipient_name, program_name, status, verification_code)
VALUES
  ('bbbbbbbb-1111-1111-0000-000000000000', '99999999-0000-0000-0000-000000000000', 'cccccccc-1111-1111-0000-000000000000', 'CERT-001', 'Ahmad Dzulqarnain', 'Program Bimbingan Islam Reguler', 'issued', 'VER-001'),
  ('bbbbbbbb-2222-2222-0000-000000000000', '99999999-0000-0000-0000-000000000002', 'cccccccc-1111-1111-0000-000000000000', 'CERT-002', 'Budi Santoso', 'Program Bimbingan Islam Reguler', 'issued', 'VER-002')
ON CONFLICT (id) DO NOTHING;

-------------------------------------------------------------------------------
-- 12. ADMISSION (APPLICANTS)
-------------------------------------------------------------------------------
INSERT INTO public.applicants (id, full_name, email, phone, city, gender, birth_date, status)
VALUES
  ('aaaaaaaa-1111-1111-0000-000000000000', 'Umar bin Khattab', 'umar@lmsypia.com', '628999999999', 'Makassar', 'Laki-laki', '2000-01-01', 'under_review'),
  ('aaaaaaaa-2222-2222-0000-000000000000', 'Khadijah', 'khadijah@lmsypia.com', '628888888888', 'Bandung', 'Perempuan', '2002-05-15', 'submitted')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.applicant_program_choices (applicant_id, program_id, preferred_batch_id)
VALUES
  ('aaaaaaaa-1111-1111-0000-000000000000', '33333333-0000-0000-0000-000000000000', '44444444-0000-0000-0000-000000000000'),
  ('aaaaaaaa-2222-2222-0000-000000000000', '33333333-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-------------------------------------------------------------------------------
-- 13. AUDIT LOGS
-------------------------------------------------------------------------------
INSERT INTO public.audit_logs (id, user_id, action, entity_type, entity_id, details)
VALUES
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'LOGIN', 'auth', '11111111-1111-1111-1111-111111111111', '{"ip_address": "192.168.1.1", "user_agent": "Mozilla/5.0"}'::jsonb),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'UPDATE_SETTINGS', 'system', NULL, '{"ip_address": "192.168.1.1", "user_agent": "Mozilla/5.0", "old_data": {"maintenance": false}, "new_data": {"maintenance": true}}'::jsonb),
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'VERIFY_PAYMENT', 'transactions', 'dddddddd-1111-1111-0000-000000000000', '{"ip_address": "192.168.1.1", "user_agent": "Mozilla/5.0", "old_data": {"status": "pending"}, "new_data": {"status": "verified"}}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Data dummy berhasil di-inject (Extended)!
