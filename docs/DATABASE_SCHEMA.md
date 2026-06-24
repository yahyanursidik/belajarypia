# DATABASE_SCHEMA.md
# Supabase Database Schema Plan

## General Notes
- Use UUID primary keys unless there is a strong reason not to.
- Use `created_at`, `updated_at`, and optionally `deleted_at` for core tables.
- Enable RLS for all sensitive tables.
- Store file metadata in database; store actual files in Contabo S3.
- Do not create audio/video upload tables for MVP.
- AI tables are not included in MVP.

---

## 1. Identity and Access

### profiles
- id uuid PK, references auth.users(id)
- full_name text
- email text
- phone text
- avatar_url text nullable
- status text default 'active'
- created_at timestamptz
- updated_at timestamptz

### roles
- id uuid PK
- code text unique
- name text
- description text nullable
- created_at timestamptz

### permissions
- id uuid PK
- code text unique
- name text
- module text
- created_at timestamptz

### user_roles
- id uuid PK
- user_id uuid references profiles(id)
- role_id uuid references roles(id)
- scope_type text nullable
- scope_id uuid nullable
- created_at timestamptz

### role_permissions
- id uuid PK
- role_id uuid references roles(id)
- permission_id uuid references permissions(id)
- created_at timestamptz

---

## 2. Organization

### organizations
- id uuid PK
- name text
- legal_name text nullable
- status text default 'active'
- created_at timestamptz
- updated_at timestamptz

### units
- id uuid PK
- organization_id uuid references organizations(id)
- code text
- name text
- description text nullable
- status text default 'active'
- created_at timestamptz
- updated_at timestamptz

### unit_users
- id uuid PK
- unit_id uuid references units(id)
- user_id uuid references profiles(id)
- role_in_unit text
- created_at timestamptz

---

## 3. Admission

### registration_forms
- id uuid PK
- program_id uuid nullable
- title text
- description text nullable
- status text default 'draft'
- created_at timestamptz
- updated_at timestamptz

### registration_form_fields
- id uuid PK
- form_id uuid references registration_forms(id)
- field_key text
- label text
- field_type text
- is_required boolean default false
- options_json jsonb nullable
- order_no int
- created_at timestamptz

### applicants
- id uuid PK
- full_name text
- email text
- phone text
- city text nullable
- gender text nullable
- birth_date date nullable
- source_channel text nullable
- status text default 'submitted'
- submitted_at timestamptz
- created_at timestamptz
- updated_at timestamptz

### applicant_program_choices
- id uuid PK
- applicant_id uuid references applicants(id)
- program_id uuid references programs(id)
- preferred_batch_id uuid nullable references batches(id)
- preferred_schedule text nullable
- notes text nullable
- created_at timestamptz

### applicant_answers
- id uuid PK
- applicant_id uuid references applicants(id)
- form_field_key text
- value_text text nullable
- value_json jsonb nullable
- created_at timestamptz

### placement_results
- id uuid PK
- applicant_id uuid references applicants(id)
- program_id uuid references programs(id)
- recommended_level_id uuid nullable references levels(id)
- reviewer_user_id uuid nullable references profiles(id)
- result_notes text nullable
- score_json jsonb nullable
- created_at timestamptz

---

## 4. Participants and Guardians

### participants
- id uuid PK
- user_id uuid nullable references profiles(id)
- global_participant_number text unique
- display_name text
- gender text nullable
- birth_date date nullable
- city text nullable
- participant_type text default 'adult'
- status text default 'active'
- joined_at timestamptz
- created_at timestamptz
- updated_at timestamptz

### guardians
- id uuid PK
- user_id uuid references profiles(id)
- relation_type text nullable
- notes text nullable
- created_at timestamptz

### guardian_participants
- id uuid PK
- guardian_id uuid references guardians(id)
- participant_id uuid references participants(id)
- is_primary boolean default false
- created_at timestamptz

---

## 5. Academic Structure

### programs
- id uuid PK
- unit_id uuid references units(id)
- code text
- name text
- description text nullable
- program_type text
- curriculum_model text
- delivery_mode text
- status text default 'draft'
- feature_flags jsonb default '{}'
- created_at timestamptz
- updated_at timestamptz

### program_tracks
- id uuid PK
- program_id uuid references programs(id)
- code text
- name text
- description text nullable
- created_at timestamptz

### levels
- id uuid PK
- program_id uuid references programs(id)
- parent_level_id uuid nullable references levels(id)
- code text
- name text
- order_no int
- passing_rule_json jsonb nullable
- created_at timestamptz

### batches
- id uuid PK
- program_id uuid references programs(id)
- code text
- name text
- start_date date nullable
- end_date date nullable
- enrollment_open_at timestamptz nullable
- enrollment_close_at timestamptz nullable
- status text default 'draft'
- created_at timestamptz

### classes
- id uuid PK
- program_id uuid references programs(id)
- batch_id uuid references batches(id)
- level_id uuid nullable references levels(id)
- track_id uuid nullable references program_tracks(id)
- code text
- name text
- capacity int nullable
- teacher_user_id uuid nullable references profiles(id)
- status text default 'active'
- created_at timestamptz

### halaqahs
- id uuid PK
- class_id uuid references classes(id)
- code text
- name text
- capacity int nullable
- mentor_user_id uuid nullable references profiles(id)
- status text default 'active'
- created_at timestamptz

### enrollments
- id uuid PK
- participant_id uuid references participants(id)
- program_id uuid references programs(id)
- batch_id uuid nullable references batches(id)
- class_id uuid nullable references classes(id)
- halaqah_id uuid nullable references halaqahs(id)
- level_id uuid nullable references levels(id)
- track_id uuid nullable references program_tracks(id)
- enrollment_number text unique
- enrollment_status text default 'pending'
- payment_status text default 'not_required'
- started_at timestamptz nullable
- ended_at timestamptz nullable
- created_at timestamptz
- updated_at timestamptz

### enrollment_status_logs
- id uuid PK
- enrollment_id uuid references enrollments(id)
- old_status text nullable
- new_status text
- reason text nullable
- changed_by uuid nullable references profiles(id)
- created_at timestamptz

---

## 6. Onboarding and Communication Mapping

### onboarding_templates
- id uuid PK
- program_id uuid references programs(id)
- title text
- description text nullable
- status text default 'active'
- created_at timestamptz

### onboarding_steps
- id uuid PK
- template_id uuid references onboarding_templates(id)
- step_key text
- title text
- description text nullable
- order_no int
- is_required boolean default true
- created_at timestamptz

### onboarding_progresses
- id uuid PK
- participant_id uuid references participants(id)
- enrollment_id uuid references enrollments(id)
- template_id uuid nullable references onboarding_templates(id)
- status text default 'not_started'
- completed_at timestamptz nullable
- created_at timestamptz
- updated_at timestamptz

### onboarding_step_progresses
- id uuid PK
- onboarding_progress_id uuid references onboarding_progresses(id)
- step_key text
- completed_at timestamptz nullable
- created_at timestamptz

### whatsapp_groups
- id uuid PK
- scope_type text
- scope_id uuid
- group_name text
- invite_link text
- is_active boolean default true
- notes text nullable
- created_at timestamptz
- updated_at timestamptz

---

## 7. Curriculum, Lessons, and Documents

### curriculum_templates
- id uuid PK
- name text
- curriculum_model text
- description text nullable
- is_active boolean default true
- created_at timestamptz

### program_modules
- id uuid PK
- program_id uuid references programs(id)
- parent_module_id uuid nullable references program_modules(id)
- level_id uuid nullable references levels(id)
- code text
- title text
- module_type text default 'lesson_group'
- order_no int
- is_required boolean default true
- created_at timestamptz

### lessons
- id uuid PK
- module_id uuid references program_modules(id)
- code text
- title text
- lesson_type text default 'content'
- order_no int
- release_at timestamptz nullable
- due_at timestamptz nullable
- visibility_status text default 'draft'
- created_at timestamptz
- updated_at timestamptz

### lesson_contents
- id uuid PK
- lesson_id uuid references lessons(id)
- content_type text
- title text
- body_html text nullable
- external_url text nullable
- document_file_id uuid nullable references document_files(id)
- metadata_json jsonb nullable
- version_no int default 1
- created_at timestamptz

### lesson_prerequisites
- id uuid PK
- lesson_id uuid references lessons(id)
- prerequisite_lesson_id uuid references lessons(id)
- rule_type text default 'completed'
- created_at timestamptz

### document_files
- id uuid PK
- owner_user_id uuid references profiles(id)
- unit_id uuid nullable references units(id)
- program_id uuid nullable references programs(id)
- related_entity_type text nullable
- related_entity_id uuid nullable
- bucket text
- object_key text
- original_filename text
- mime_type text
- file_size bigint
- visibility text default 'private'
- upload_status text default 'completed'
- created_at timestamptz

### content_versions
- id uuid PK
- lesson_content_id uuid references lesson_contents(id)
- version_no int
- snapshot_json jsonb
- created_by uuid nullable references profiles(id)
- created_at timestamptz

---

## 8. Assignments and Assessments

### assignments
- id uuid PK
- lesson_id uuid references lessons(id)
- assignment_type text
- title text
- instructions text nullable
- due_at timestamptz nullable
- max_score numeric nullable
- rubric_id uuid nullable references rubrics(id)
- allow_resubmission boolean default true
- status text default 'active'
- created_at timestamptz

### submissions
- id uuid PK
- assignment_id uuid references assignments(id)
- participant_id uuid references participants(id)
- enrollment_id uuid references enrollments(id)
- submission_type text
- submitted_at timestamptz
- content_text text nullable
- checklist_json jsonb nullable
- status text default 'submitted'
- attempt_no int default 1
- created_at timestamptz
- updated_at timestamptz

### submission_files
- id uuid PK
- submission_id uuid references submissions(id)
- document_file_id uuid references document_files(id)
- created_at timestamptz

### submission_comments
- id uuid PK
- submission_id uuid references submissions(id)
- user_id uuid references profiles(id)
- comment_text text
- created_at timestamptz

### rubrics
- id uuid PK
- name text
- rubric_type text
- max_score numeric nullable
- created_at timestamptz

### rubric_criteria
- id uuid PK
- rubric_id uuid references rubrics(id)
- criterion_name text
- description text nullable
- weight numeric nullable
- order_no int
- created_at timestamptz

### assessments
- id uuid PK
- submission_id uuid nullable references submissions(id)
- quran_setoran_record_id uuid nullable references quran_setoran_records(id)
- assessor_user_id uuid references profiles(id)
- score numeric nullable
- feedback_text text nullable
- assessed_at timestamptz
- assessment_status text default 'draft'
- created_at timestamptz

---

## 9. Qur'an Manual Review

### quran_targets
- id uuid PK
- enrollment_id uuid references enrollments(id)
- target_type text
- surah_no int nullable
- ayah_start int nullable
- ayah_end int nullable
- target_date date nullable
- status text default 'active'
- notes text nullable
- created_at timestamptz

### quran_setoran_records
- id uuid PK
- enrollment_id uuid references enrollments(id)
- quran_target_id uuid nullable references quran_targets(id)
- reviewer_user_id uuid references profiles(id)
- setoran_date date
- setoran_mode text
- surah_no int nullable
- ayah_start int nullable
- ayah_end int nullable
- review_status text
- tajwid_notes text nullable
- fluency_notes text nullable
- memorization_notes text nullable
- next_action text nullable
- created_at timestamptz

### quran_reviews
- id uuid PK
- quran_setoran_record_id uuid references quran_setoran_records(id)
- reviewer_user_id uuid references profiles(id)
- score numeric nullable
- feedback_text text nullable
- reviewed_at timestamptz
- created_at timestamptz

### quran_review_templates
- id uuid PK
- program_id uuid nullable references programs(id)
- name text
- template_json jsonb
- created_at timestamptz

---

## 10. Live Sessions and Attendance

### live_sessions
- id uuid PK
- class_id uuid references classes(id)
- lesson_id uuid nullable references lessons(id)
- title text
- provider text nullable
- meeting_url text nullable
- external_recording_url text nullable
- start_at timestamptz
- end_at timestamptz
- status text default 'scheduled'
- created_at timestamptz

### attendances
- id uuid PK
- live_session_id uuid references live_sessions(id)
- participant_id uuid references participants(id)
- attendance_status text
- checked_in_at timestamptz nullable
- notes text nullable
- created_at timestamptz

### session_notes
- id uuid PK
- live_session_id uuid references live_sessions(id)
- created_by uuid references profiles(id)
- notes text
- created_at timestamptz

---

## 11. Discussion and Announcements

### discussion_threads
- id uuid PK
- lesson_id uuid nullable references lessons(id)
- class_id uuid nullable references classes(id)
- created_by_user_id uuid references profiles(id)
- title text
- status text default 'open'
- created_at timestamptz

### discussion_posts
- id uuid PK
- thread_id uuid references discussion_threads(id)
- user_id uuid references profiles(id)
- parent_post_id uuid nullable references discussion_posts(id)
- body_text text
- moderation_status text default 'visible'
- created_at timestamptz

### mentor_notes
- id uuid PK
- enrollment_id uuid references enrollments(id)
- mentor_user_id uuid references profiles(id)
- note_text text
- visibility text default 'staff_only'
- created_at timestamptz

### announcements
- id uuid PK
- scope_type text
- scope_id uuid
- title text
- body_text text
- published_at timestamptz nullable
- expires_at timestamptz nullable
- created_by uuid references profiles(id)
- created_at timestamptz

---

## 12. Finance

### invoices
- id uuid PK
- participant_id uuid references participants(id)
- enrollment_id uuid nullable references enrollments(id)
- invoice_number text unique
- amount numeric
- due_date date nullable
- payment_status text default 'pending'
- created_at timestamptz

### payments
- id uuid PK
- invoice_id uuid references invoices(id)
- method text nullable
- paid_amount numeric
- paid_at timestamptz nullable
- reference_number text nullable
- verification_status text default 'pending'
- verified_by uuid nullable references profiles(id)
- verified_at timestamptz nullable
- created_at timestamptz

### payment_proofs
- id uuid PK
- payment_id uuid references payments(id)
- document_file_id uuid references document_files(id)
- created_at timestamptz

### discounts
- id uuid PK
- enrollment_id uuid references enrollments(id)
- discount_type text
- amount numeric nullable
- notes text nullable
- created_at timestamptz

### scholarships
- id uuid PK
- enrollment_id uuid references enrollments(id)
- scholarship_type text
- amount numeric nullable
- notes text nullable
- created_at timestamptz

---

## 13. Certificates

### certificate_templates
- id uuid PK
- program_id uuid references programs(id)
- name text
- template_data_json jsonb
- status text default 'active'
- created_at timestamptz

### certificate_rules
- id uuid PK
- program_id uuid references programs(id)
- rule_json jsonb
- created_at timestamptz

### certificates
- id uuid PK
- enrollment_id uuid references enrollments(id)
- certificate_number text unique
- certificate_template_id uuid nullable references certificate_templates(id)
- document_file_id uuid nullable references document_files(id)
- issued_at timestamptz nullable
- status text default 'draft'
- created_at timestamptz

---

## 14. Helpdesk and Notifications

### helpdesk_tickets
- id uuid PK
- user_id uuid references profiles(id)
- enrollment_id uuid nullable references enrollments(id)
- category text
- subject text
- body_text text
- status text default 'open'
- assigned_to_user_id uuid nullable references profiles(id)
- created_at timestamptz
- updated_at timestamptz

### helpdesk_messages
- id uuid PK
- ticket_id uuid references helpdesk_tickets(id)
- user_id uuid references profiles(id)
- message_text text
- created_at timestamptz

### faq_articles
- id uuid PK
- category text
- title text
- body_text text
- status text default 'published'
- created_at timestamptz

### notification_templates
- id uuid PK
- code text unique
- channel text
- subject text nullable
- body_template text
- status text default 'active'
- created_at timestamptz

### notifications
- id uuid PK
- user_id uuid references profiles(id)
- channel text
- title text
- body_text text
- status text default 'pending'
- sent_at timestamptz nullable
- created_at timestamptz

### notification_logs
- id uuid PK
- notification_id uuid nullable references notifications(id)
- event_type text
- status text
- error_message text nullable
- created_at timestamptz

### user_notification_preferences
- id uuid PK
- user_id uuid references profiles(id)
- channel text
- is_enabled boolean default true
- created_at timestamptz

---

## 15. System

### feature_flags
- id uuid PK
- scope_type text
- scope_id uuid
- flag_key text
- flag_value boolean default false
- created_at timestamptz

### audit_logs
- id uuid PK
- actor_user_id uuid nullable references profiles(id)
- action text
- entity_type text
- entity_id uuid nullable
- old_data jsonb nullable
- new_data jsonb nullable
- created_at timestamptz

### progress_snapshots
- id uuid PK
- enrollment_id uuid references enrollments(id)
- progress_json jsonb
- calculated_at timestamptz

### learner_events
- id uuid PK
- enrollment_id uuid references enrollments(id)
- participant_id uuid references participants(id)
- event_type text
- event_data jsonb nullable
- created_at timestamptz

### risk_flags
- id uuid PK
- enrollment_id uuid references enrollments(id)
- flag_type text
- severity text
- status text default 'open'
- notes text nullable
- created_at timestamptz
