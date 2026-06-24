# PRD.md
# YPIA Learning Management System

## 1. Product Summary
YPIA LMS is a web-based Learning Management System for Yayasan Pendidikan Ihsanul Adab. It supports flexible Islamic education and parenting programs, including Qur'an learning, kitab/matan classes, Arabic classes, parenting classes, cohort-based learning, level-based learning, halaqah-based learning, assignments, live sessions, attendance, onboarding, and progress tracking.

## 2. MVP Stack
- Vite
- React
- TypeScript
- Refine
- Ant Design
- Supabase Auth
- Supabase PostgreSQL
- Supabase Row Level Security
- Supabase Edge Functions
- Contabo S3-compatible Object Storage for documents only
- Vercel deployment

## 3. Important MVP Scope Decisions
### Included
- Auth and role-based access
- Organization/unit management
- Registration and admission
- Participant ID generation
- Enrollment
- Onboarding with email and WhatsApp group link mapping
- Program, batch, class, halaqah management
- Curriculum and lesson management
- Document-based content
- Assignment text/document/checklist submission
- Qur'an target and manual setoran review
- Live session schedule
- Attendance
- Manual payment status
- Helpdesk
- Notifications/logs
- Basic progress dashboard
- Basic certificate eligibility and issuing

### Excluded from MVP
- AI Assist Layer
- Audio/video upload
- Native mobile app
- Payment gateway
- Advanced automation builder
- LTI integration
- LRS/xAPI
- Advanced analytics
- Full finance/accounting system

## 4. Problem Statement
YPIA runs multiple learning models that do not fit a rigid LMS format. Qur'an learning needs targets, setoran records, tajwid notes, and progress per surah/ayah. Parenting programs need reflection, checklist, and mentoring. Kitab and mutun programs need structured lessons, manual review, and flexible progression.

Manual operations around registration, onboarding, WhatsApp group sharing, participant ID creation, class assignment, and progress tracking can become scattered and inconsistent.

## 5. Product Goals
1. Provide a flexible LMS for different Islamic and parenting learning models.
2. Reduce manual admin work during registration, enrollment, and onboarding.
3. Give teachers a clean workspace to manage classes, lessons, assignments, attendance, Qur'an targets, and feedback.
4. Give participants a guided learning portal with clear next steps.
5. Provide role-based access for superadmin, admin, teacher, mentor, participant, guardian, finance, and helpdesk.
6. Keep the MVP lightweight by avoiding audio/video upload and AI.

## 6. Personas
### Super Admin
Controls system-wide governance, roles, permissions, integrations, audit logs, and global reports.

### Admin Program / Academic Admin
Manages applicants, participants, enrollments, programs, batches, classes, halaqahs, teachers, onboarding, announcements, and reports.

### Teacher / Ustadz / Trainer
Manages lessons, assignments, reviews, attendance, discussions, and class progress.

### Mentor / Musyrif
Manages halaqah participants, Qur'an setoran records, mentoring notes, and participant progress.

### Participant
Registers, completes onboarding, accesses lessons, submits assignments, views schedules, sees feedback, and monitors progress.

### Guardian / Parent
Views child progress, schedule, announcements, and tasks if parent portal is enabled.

### Finance
Manages invoice status, payment proof, manual verification, scholarship/discount notes, and enrollment hold/release.

### Helpdesk
Handles login, onboarding, payment, class access, WhatsApp group, and other support tickets.

## 7. High-Level User Flow
1. Public user views program catalog.
2. User fills registration form.
3. Applicant record is created.
4. Admin reviews applicant.
5. Admin approves applicant.
6. System generates participant profile and global participant number.
7. System creates enrollment.
8. Admin assigns batch/class/halaqah if needed.
9. Onboarding email is sent.
10. Participant logs in.
11. Participant completes onboarding checklist.
12. Participant accesses program dashboard.
13. Participant follows lessons, assignments, live sessions, and discussions.
14. Teacher reviews assignments and Qur'an manual setoran.
15. Progress is updated.
16. Certificate can be issued if rules are fulfilled.

## 8. Core Business Rules
1. A participant has one global participant number.
2. A participant may have multiple enrollments.
3. Enrollment belongs to one program, batch, class, and optionally halaqah.
4. WhatsApp group link is shown only when enrollment is active and the program uses WhatsApp group.
5. Audio/video upload is not allowed in MVP.
6. Qur'an setoran is recorded manually by teacher/mentor.
7. AI is not visible or active in MVP.
8. File upload is limited to non-audio/video documents/images.
9. Sensitive tables must use RLS.
10. Business-critical actions must go through Edge Functions or secure SQL functions.

## 9. Success Metrics
- Registration completion rate
- Applicant-to-enrollment conversion rate
- Onboarding completion rate
- Lesson completion rate
- Assignment submission rate
- Attendance rate
- Qur'an target review completion
- Helpdesk response time
- Admin processing time reduction
- Participant satisfaction during first 30 days

## 10. Definition of Done for MVP
MVP is done when:
1. Public user can register.
2. Admin can review and approve applicant.
3. Participant ID is generated.
4. Enrollment is created.
5. Onboarding email/log is triggered.
6. Participant can log in.
7. Participant can access assigned program.
8. Participant can view lessons.
9. Participant can submit text/document/checklist assignments.
10. Teacher can review and give feedback.
11. Teacher can create Qur'an target.
12. Teacher can record manual Qur'an setoran review.
13. Participant can see Qur'an review result.
14. Admin can see progress summary.
15. Finance can verify payment manually.
16. Document upload uses signed URL.
17. Audio/video upload is rejected.
18. RLS is active on sensitive tables.
19. Role-based navigation works.
20. App deploys on Vercel.
