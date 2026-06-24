# PROMPT_LOG.md
# Codex Prompt Log

Use this file to track Codex tasks, prompts, outputs, issues, and next actions.

---

## Template

### Task ID
Example: PHASE-0-001

### Date
YYYY-MM-DD

### Phase
Example: Phase 0 — Technical Foundation

### Prompt
Paste the exact prompt sent to Codex.

### Scope
- item 1
- item 2
- item 3

### Files Changed
- file path 1
- file path 2

### Result Summary
Write what Codex implemented.

### Commands Run
```bash
npm run lint
npm run typecheck
npm run build
```

### Issues Found
- issue 1
- issue 2

### Follow-Up Task
Write the next recommended task.

---

## PHASE-0-001

### Date
2026-06-24

### Phase
Phase 0 — Technical Foundation

### Prompt
Baca AGENTS.md dan docs/STACK.md. Kerjakan Phase 0 foundation untuk LMS YPIA. Dilanjutkan dengan migrasi ke React terbaru, Refine core v5 headless, shadcn/ui, dan Tailwind CSS.

### Scope
- Vite + React + TypeScript project foundation
- Refine provider skeleton
- shadcn/ui-style local components and Tailwind CSS theme
- Supabase client setup
- Public, auth, admin, teacher, learner, and superadmin placeholder routes
- Basic role layouts and placeholder dashboards
- env.example

### Files Changed
- package.json
- package-lock.json
- index.html
- vite.config.ts
- eslint.config.js
- tsconfig.json
- tsconfig.app.json
- tsconfig.node.json
- env.example
- src/

### Result Summary
Created Phase 0 technical foundation for YPIA LMS using React 19, Refine core v5 headless, shadcn/ui-style local components, Tailwind CSS, and Supabase client setup. Did not implement database, RLS, admission, enrollment, AI, upload, or academic modules.

### Commands Run
```bash
npm.cmd install
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

### Issues Found
- npm install reports 1 low severity audit finding. No automatic audit fix was applied.
- Vite build warned that the main JS chunk is larger than 500 kB; code splitting can be handled in a later phase.

### Follow-Up Task
Phase 1: implement Supabase Auth, profiles, roles, permissions, authProvider, accessControlProvider, protected routes, and role-based navigation.

---

## PHASE-1-001

### Date
2026-06-24

### Phase
Phase 1 — Supabase schema dasar + Auth + RBAC

### Prompt
Phase 1 — Supabase schema dasar + Auth + RBAC. Tujuan: user bisa login dan menu tampil sesuai role.

### Scope
- Supabase migration for profiles, roles, permissions, user_roles, role_permissions
- Initial RLS policies for identity/RBAC tables
- Supabase Auth login flow
- Refine authProvider and accessControlProvider
- Role-based navigation
- Protected routes
- Dashboard redirect by role

### Files Changed
- supabase/migrations/202606240001_phase_1_auth_rbac.sql
- src/lib/auth.ts
- src/lib/navigation.ts
- src/app/providers/authProvider.ts
- src/app/providers/accessControlProvider.ts
- src/app/providers/AuthSessionProvider.tsx
- src/app/providers/authSessionContext.ts
- src/routes/AppRoutes.tsx
- src/routes/ProtectedRoute.tsx
- src/routes/auth/LoginPage.tsx
- src/routes/auth/NoRolePage.tsx
- src/layouts/
- src/styles/global.css

### Result Summary
Implemented Phase 1 Auth/RBAC foundation. No registration, admission, enrollment, upload, AI, or academic module was added.

### Commands Run
```bash
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

### Issues Found
- Vite build warned that the main JS chunk is larger than 500 kB; route-level lazy loading can be added later.
- Supabase migration was authored but not applied to a remote/local Supabase project from this environment.

### Follow-Up Task
Apply the Supabase migration, create the first super_admin user role assignment, then test login/route access for each role.

---

## PHASE-2-001

### Date
2026-06-24

### Phase
Phase 2 — Organization, Unit, Program Basic

### Prompt
Phase 2 — Organization, Unit, Program basic. Tujuan: struktur yayasan → unit → program siap.

### Scope
- Supabase migration for organizations, units, unit_users, and programs
- Initial RLS policies for unit-scoped organization/program access
- Refine resources for organizations, units, and programs
- Super Admin unit governance page
- Admin program list/create page
- Program status draft/active/archived
- MVP feature flags per program

### Files Changed
- supabase/migrations/202606240002_phase_2_organization_unit_program.sql
- src/app/providers/dataProvider.ts
- src/app/providers/RefineProvider.tsx
- src/lib/auth.ts
- src/lib/navigation.ts
- src/lib/organization.ts
- src/routes/AppRoutes.tsx
- src/routes/admin/AdminProgramListPage.tsx
- src/routes/superadmin/UnitGovernancePage.tsx
- src/styles/global.css

### Result Summary
Implemented basic organization → unit → program foundation. Did not implement registration, admission, enrollment, upload, AI, or academic modules.

### Commands Run
```bash
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

### Issues Found
- Supabase migration was authored but not applied to a remote/local Supabase project from this environment.
- Admin unit assignment is supported by `unit_users` and RLS, but the UI for assigning admins to units is not yet built.

### Follow-Up Task
Apply migrations, seed or assign admins to `unit_users`, then test Super Admin unit creation and Admin program visibility per assigned unit.

---

## PHASE-3-001

### Date
2026-06-24

### Phase
Phase 3 — Registration dan Admission

### Prompt
Phase 3 — Registration dan Admission. Tujuan: calon peserta bisa daftar, admin bisa review.

### Scope
- Public active program listing
- Public program detail
- Simple dynamic registration form
- Supabase migration for registration_forms, registration_form_fields, applicants, applicant_answers, applicant_program_choices
- Admin applicant list
- Applicant detail review panel
- Applicant workflow: under_review, revision_requested, accepted, rejected

### Files Changed
- supabase/migrations/202606240003_phase_3_registration_admission.sql
- src/lib/admission.ts
- src/lib/auth.ts
- src/lib/navigation.ts
- src/app/providers/RefineProvider.tsx
- src/app/providers/accessControlProvider.ts
- src/routes/AppRoutes.tsx
- src/routes/public/ProgramCatalogPage.tsx
- src/routes/public/ProgramDetailPage.tsx
- src/routes/public/ProgramRegistrationPage.tsx
- src/routes/admin/AdminApplicantListPage.tsx
- src/styles/global.css

### Result Summary
Implemented public registration and admin admission review. Approval only changes applicant status to accepted; no participant record or participant number is created in this phase.

### Commands Run
```bash
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

### Issues Found
- Supabase migration was authored but not applied to a remote/local Supabase project from this environment.
- Registration form builder UI is not included; public form reads active registration form fields when available and falls back to default fields.

### Follow-Up Task
Apply Phase 3 migration, activate at least one program, submit a public test registration, then review it from Admin Pendaftaran.

---

## PHASE-4-001

### Date
2026-06-24

### Phase
Phase 4 — Participant ID, Enrollment, Onboarding

### Prompt
Phase 4 — Participant ID, Enrollment, Onboarding. Tujuan: applicant diterima menjadi peserta aktif.

### Scope
- participants and guardian base tables
- batches, classes, halaqahs for basic placement
- enrollments and enrollment status logs
- unique participant number generator
- approve_applicant RPC for applicant → participant + enrollment
- onboarding template/progress/checklist setup
- welcome email placeholder notification log
- WhatsApp group mapping table and learner dashboard display

### Files Changed
- supabase/migrations/202606240004_phase_4_participant_enrollment_onboarding.sql
- src/lib/enrollment.ts
- src/routes/admin/AdminApplicantListPage.tsx
- src/routes/learner/LearnerDashboardPage.tsx
- src/app/providers/RefineProvider.tsx
- supabase/migrations/202606240003_phase_3_registration_admission.sql

### Result Summary
Implemented approval-to-participant flow. Admin approval now creates participant, unique participant number, active enrollment, onboarding checklist, participant role assignment when a matching Auth profile exists, and welcome email placeholder log. Learner dashboard now shows active programs and eligible WhatsApp links.

### Commands Run
```bash
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

### Issues Found
- Supabase migration was authored but not applied to a remote/local Supabase project from this environment.
- Batch/class/halaqah tables and assignment are supported, but UI to create those placement records is still minimal/not built as a full academic structure module.

### Follow-Up Task
Apply Phase 4 migration, create placement records if needed, approve a test applicant, then login as the participant user to verify enrollment and WhatsApp visibility.

---

## PHASE-5-001

### Date
2026-06-24

### Phase
Phase 5 - Program Builder, Batch, Class, Halaqah

### Prompt
Phase 5 - Program Builder, Batch, Class, Halaqah. Tujuan: admin bisa membuat struktur akademik.

### Scope
- Supabase migration for levels, program_modules, lessons, and lesson_prerequisites
- RLS policies for academic builder access and learner lesson visibility
- Admin program builder page for batch, class, halaqah, level, module, lesson, prerequisite, and release date
- Teacher/mentor assignment fields for class and halaqah
- Refine resources and access control for academic resources
- Learner program lesson tree scoped to active enrollments

### Files Changed
- supabase/migrations/202606240005_phase_5_program_builder_academic.sql
- src/lib/academic.ts
- src/lib/auth.ts
- src/lib/navigation.ts
- src/app/providers/RefineProvider.tsx
- src/app/providers/accessControlProvider.ts
- src/routes/AppRoutes.tsx
- src/routes/admin/AdminAcademicBuilderPage.tsx
- src/routes/learner/LearnerProgramLessonsPage.tsx
- docs/PROMPT_LOG.md

### Result Summary
Implemented Phase 5 academic structure foundation. Admin can create batches, classes, halaqahs, levels, modules, and lessons with basic prerequisite and release date fields. Learners can view published/released lessons for their active program enrollments only.

### Commands Run
```bash
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

### Issues Found
- Supabase migration was authored but not applied to a remote/local Supabase project from this environment.
- Lesson content body, assignment workflows, progress tracking, and completion prerequisites are not implemented yet.

### Follow-Up Task
Apply Phase 5 migration, create test academic records from `/admin/akademik`, publish a lesson, then login as a participant to verify `/learner/program-saya`.

---

## PHASE-6-001

### Date
2026-06-24

### Phase
Phase 6 - Content dan Document Library

### Prompt
Phase 6 - Content dan Document Library. Tujuan: materi teks/dokumen bisa dikelola. Uji kecil dulu dan jangan campur dengan modul lain.

### Scope
- Lesson content editor sederhana
- document_files metadata table
- RLS for staff-managed content and enrolled learner access
- Signed upload/download Edge Function for private Contabo S3-compatible storage
- Admin/teacher content UI for text, external links, and private file upload
- Learner lesson UI for text, link, and signed file opening

### Files Changed
- supabase/migrations/202606240006_phase_6_content_document_library.sql
- supabase/functions/document-signed-url/index.ts
- env.example
- src/lib/academic.ts
- src/lib/documents.ts
- src/lib/auth.ts
- src/lib/navigation.ts
- src/app/providers/RefineProvider.tsx
- src/app/providers/accessControlProvider.ts
- src/routes/AppRoutes.tsx
- src/routes/admin/AdminAcademicBuilderPage.tsx
- src/routes/learner/LearnerProgramLessonsPage.tsx
- docs/PROMPT_LOG.md

### Result Summary
Implemented a small Phase 6 POC for content and private document library. Admin/teacher can save lesson text, external links, and upload private files through signed upload URLs. Learners can only see active lesson files through their enrollment and open files through signed download URLs.

### Commands Run
```bash
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

### Issues Found
- Supabase migration and Edge Function were authored but not deployed/applied from this environment.
- Upload cleanup for orphaned S3 objects after metadata insert failure is not implemented in this POC.
- Rich text editor, file versioning, virus scanning, transcoding, and progress/completion tracking are intentionally out of scope.

### Follow-Up Task
Apply Phase 6 migration, deploy `document-signed-url`, set Contabo S3 secrets, then test one PDF upload and one learner signed download before adding richer content features.
