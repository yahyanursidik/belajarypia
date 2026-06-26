DO $$ 
DECLARE
    v_program_id uuid;
    v_applicant_id uuid;
    v_status text;
    v_statuses text[] := ARRAY['submitted', 'under_review', 'revision_requested', 'accepted', 'rejected'];
    v_first_names text[] := ARRAY['Budi', 'Siti', 'Ahmad', 'Rina', 'Joko', 'Dewi', 'Andi', 'Maya', 'Eko', 'Dian', 'Fajar', 'Tari', 'Hadi', 'Sari', 'Rudi'];
    v_last_names text[] := ARRAY['Santoso', 'Wijaya', 'Kusuma', 'Pratama', 'Sari', 'Lestari', 'Hidayat', 'Putra', 'Nugroho', 'Saputra'];
    v_cities text[] := ARRAY['Jakarta', 'Bandung', 'Surabaya', 'Yogyakarta', 'Semarang', 'Malang', 'Medan', 'Makassar'];
    v_genders text[] := ARRAY['male', 'female'];
    i integer;
BEGIN
    -- Get one active program
    SELECT id INTO v_program_id FROM public.programs WHERE status = 'active' LIMIT 1;
    
    IF v_program_id IS NULL THEN
        RAISE NOTICE 'No active program found. Skipping dummy data insertion.';
        RETURN;
    END IF;

    -- Generate 35 dummy applicants
    FOR i IN 1..35 LOOP
        v_applicant_id := gen_random_uuid();
        v_status := v_statuses[1 + (i % 5)]; -- distribute statuses evenly
        
        -- Insert applicant
        INSERT INTO public.applicants (
            id, full_name, email, phone, city, gender, birth_date, status, created_at, submitted_at
        ) VALUES (
            v_applicant_id,
            v_first_names[1 + (i % 15)] || ' ' || v_last_names[1 + (i % 10)] || ' ' || i,
            'dummy' || i || '@example.com',
            '081234567' || lpad(i::text, 3, '0'),
            v_cities[1 + (i % 8)],
            v_genders[1 + (i % 2)],
            ('199' || (i % 10) || '-0' || (1 + (i % 9)) || '-1' || (1 + (i % 8)))::date,
            v_status,
            now() - (i || ' days')::interval,
            now() - (i || ' days')::interval
        );

        -- Insert program choice
        INSERT INTO public.applicant_program_choices (
            applicant_id, program_id, preferred_schedule, notes
        ) VALUES (
            v_applicant_id,
            v_program_id,
            CASE WHEN i % 2 = 0 THEN 'Pagi' ELSE 'Malam' END,
            'Dummy notes ' || i
        );
    END LOOP;
    
    RAISE NOTICE 'Successfully inserted 35 dummy applicants for program %', v_program_id;
END $$;
