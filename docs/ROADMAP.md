# ROADMAP.md
# Development Roadmap for YPIA LMS

## Development Principle
Build the LMS in small, testable phases. Do not ask Codex to build the whole LMS at once. Each phase must have clear scope, acceptance criteria, and review.

---

## Phase 0 — Technical Foundation
### Goal
Create the project foundation.

### Scope
- Vite + React + TypeScript setup
- Refine setup
- Ant Design setup
- Supabase client setup
- Basic layouts
- Placeholder routes
- Vercel-ready build
- env.example

### Do Not Implement
- Database schema
- Admission
- Enrollment
- Upload
- AI
- Audio/video
- Finance

### Done When
- App runs locally.
- Build succeeds.
- Placeholder dashboard exists for each role.

---

## Phase 1 — Auth, Profiles, Roles, Permissions
### Goal
User can log in and menu changes based on role.

### Scope
- Supabase Auth integration
- profiles table
- roles table
- permissions table
- user_roles table
- role_permissions table
- authProvider
- accessControlProvider
- protected routes
- role-based navigation

### Done When
- Unauthenticated users are redirected to login.
- Authenticated users are redirected to role dashboard.
- Menus differ by role.
- RLS is enabled on identity tables.

---

## Phase 2 — Organization, Unit, Program Basic
### Goal
Create organization/unit/program structure.

### Scope
- organizations
- units
- unit_users
- programs
- feature flags basic
- superadmin unit management
- admin program view

### Done When
- Superadmin can create unit.
- Admin sees only assigned unit/programs.
- Program has status and feature flags.

---

## Phase 3 — Registration and Admission
### Goal
Public user can register and admin can review applicant.

### Scope
- public program listing
- program detail
- dynamic registration form basic
- applicants
- applicant_answers
- applicant_program_choices
- admin applicant table
- applicant detail drawer
- applicant status workflow

### Done When
- Public user can submit registration.
- Admin can view applicants.
- Admin can approve/reject/request revision.
- Participant is not created before approval.

---

## Phase 4 — Participant, Enrollment, Onboarding
### Goal
Approved applicant becomes participant with enrollment.

### Scope
- participants
- guardians basic if needed
- guardian_participants
- enrollments
- participant number generation
- batch/class/halaqah assignment basic
- onboarding templates
- onboarding progress
- WhatsApp group mapping
- welcome email/log placeholder

### Done When
- Approved applicant becomes participant.
- Participant number is unique.
- Enrollment is created.
- Onboarding checklist appears.
- WA group link appears only if eligible.

---

## Phase 5 — Academic Structure
### Goal
Admin can create academic structure.

### Scope
- levels
- batches
- classes
- halaqahs
- program_modules
- lessons
- lesson prerequisites
- release date
- program builder UI

### Done When
- Admin can create batch, class, halaqah.
- Admin/teacher can create lesson.
- Participants only see lessons from their enrollment.

---

## Phase 6 — Document Content and S3 Upload
### Goal
Lessons can contain documents and external links.

### Scope
- document_files
- lesson_contents
- signed upload URL Edge Function
- signed download URL Edge Function
- Contabo S3 POC
- file type validation
- no audio/video upload

### Done When
- Document upload works.
- Audio/video upload is rejected.
- File is private.
- File metadata is stored.
- Participant can access only authorized files.

---

## Phase 7 — Assignments and Submissions
### Goal
Participant can submit text/document/checklist assignments.

### Scope
- assignments
- submissions
- submission_files
- submission_comments
- text submission
- document/image submission if allowed
- checklist submission
- teacher review
- feedback
- resubmission

### Done When
- Participant submits assignment.
- Teacher reviews and gives feedback.
- Participant sees feedback.
- Attempt history is stored.

---

## Phase 8 — Qur'an Manual Review
### Goal
Qur'an learning works without audio/video upload.

### Scope
- quran_targets
- quran_setoran_records
- quran_reviews
- quran_review_templates
- target types: tahsin, ziyadah, murojaah, tasmi
- teacher setoran workspace
- participant Qur'an progress page

### Done When
- Teacher creates Qur'an target.
- Participant sees target.
- Teacher records manual setoran.
- Participant sees review.
- Progress updates.

---

## Phase 9 — Live Sessions and Attendance
### Goal
Classes can schedule live sessions and record attendance.

### Scope
- live_sessions
- attendances
- session_notes
- manual Zoom/Meet link
- external recording link if used
- attendance grid

### Done When
- Participant sees schedule.
- Teacher records attendance.
- Admin sees attendance report.

---

## Phase 10 — Finance, Helpdesk, Notifications
### Goal
Basic operations are complete.

### Scope
- invoices
- payments
- payment proofs
- manual verification
- enrollment hold/release
- helpdesk_tickets
- helpdesk_messages
- notifications
- notification_logs

### Done When
- Participant sees invoice.
- Finance verifies payment.
- Enrollment can be held/released.
- Participant creates ticket.
- Helpdesk responds.
- Notification logs exist.

---

## Phase 11 — Progress, Certificates, Reports
### Goal
System can show learning outcomes.

### Scope
- progress_snapshots
- learner_events
- risk_flags
- certificates
- certificate_rules
- basic reports

### Done When
- Participant sees progress.
- Teacher sees class progress.
- Admin sees program progress.
- Certificate is issued only when eligible.

---

## Post-MVP
- AI Assist Layer
- Audio/video upload
- Payment gateway
- Native mobile app
- Advanced analytics
- Academic supervision
- LTI integration
- LRS/xAPI
- Advanced workflow automation
