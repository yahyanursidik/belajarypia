# UI_UX_GUIDE.md
# UI/UX Guide for YPIA LMS

## 1. Design Direction
The LMS should feel:
- clean
- warm
- professional
- calm
- easy to use
- suitable for Islamic education and parenting programs

Use Ant Design as the main UI system. Customize theme to avoid a cold corporate feel.

## 2. Language
Use Indonesian for user-facing UI.

Examples:
- Dashboard
- Program Saya
- Pendaftaran
- Peserta
- Kelas
- Halaqah
- Tugas
- Penilaian
- Setoran Qur'an
- Presensi
- Pengumuman
- Bantuan
- Pengaturan

## 3. Global Layouts
### PublicLayout
For:
- homepage
- program catalog
- program detail
- registration form
- check registration status
- login

### LearnerLayout
For participants and guardians:
- simple navigation
- mobile-friendly
- guided next steps
- bottom navigation on mobile

### TeacherLayout
For teachers/mentors:
- class-focused workspace
- review queue
- attendance
- Qur'an manual review

### AdminLayout
For admin:
- dense operational workspace
- sidebar
- tables
- filters
- drawers
- bulk actions

### SuperAdminLayout
For global governance:
- system overview
- roles/permissions
- audit logs
- integrations
- global reports

## 4. Navigation

### Public
- Beranda
- Program
- Detail Program
- Daftar
- Cek Status
- Login

### Participant
- Dashboard
- Program Saya
- Jadwal
- Tugas
- Diskusi
- Progres
- Sertifikat
- Bantuan
- Profil

### Guardian
- Dashboard
- Anak Saya
- Jadwal Anak
- Progres Anak
- Tugas Pendampingan
- Pengumuman
- Bantuan
- Profil

### Teacher / Mentor
- Dashboard
- Kelas Saya
- Jadwal
- Materi
- Tugas & Review
- Setoran Qur'an
- Presensi
- Penilaian
- Diskusi
- Analytics

### Admin
- Dashboard
- Pendaftaran
- Peserta
- Enrollment
- Program
- Batch/Kelas/Halaqah
- Pengajar
- Materi
- Tugas
- Jadwal
- Keuangan
- Sertifikat
- Helpdesk
- Laporan
- Pengaturan

### Super Admin
- Executive Dashboard
- Unit & Program Governance
- Users & Roles
- Permissions
- Global Enrollment
- Content Oversight
- Finance Oversight
- Communication Center
- Integrations
- Audit Logs
- System Settings

## 5. Ant Design Component Usage

### Admin Pages
Use:
- Table
- Form
- Drawer
- Modal
- Tabs
- Tag
- Badge
- Statistic
- Card
- Descriptions
- Steps
- Alert
- Upload
- Tree
- Dropdown
- Space

### Learner Pages
Use:
- Card
- List
- Progress
- Steps
- Alert
- Empty
- Result
- Tabs
- Collapse
- Button
- Tag

### Teacher Pages
Use:
- Table
- List
- Drawer
- Form
- Tabs
- Card
- Badge
- Tag
- Descriptions
- Timeline
- Calendar

## 6. Status System
Use consistent status badges.

### Applicant Status
- draft
- submitted
- under_review
- revision_requested
- accepted
- rejected

### Enrollment Status
- pending
- active
- hold
- completed
- cancelled

### Payment Status
- not_required
- pending
- verified
- failed
- scholarship
- discount

### Lesson Status
- draft
- published
- locked
- upcoming
- completed

### Submission Status
- draft
- submitted
- in_review
- needs_revision
- accepted
- finalized

### Qur'an Review Status
- target_created
- scheduled
- reviewed
- needs_repeat
- passed
- mutqin

### Ticket Status
- open
- in_progress
- waiting_user
- closed

## 7. Dashboard Requirements

### Participant Dashboard
Must show:
- welcome card
- current active program
- next lesson
- pending assignments
- upcoming live session
- onboarding progress
- announcements
- help link

### Teacher Dashboard
Must show:
- today's classes
- pending reviews
- Qur'an setoran queue
- attendance reminders
- participants needing attention
- content reminders

### Admin Dashboard
Must show:
- new applicants
- applicants needing review
- onboarding pending
- enrollments waiting for class assignment
- payment pending
- open helpdesk tickets
- active programs
- today sessions

### Super Admin Dashboard
Must show:
- global active participants
- active programs
- applicant funnel
- onboarding completion
- system alerts
- failed notifications
- role/permission changes
- audit highlights

## 8. Page Patterns

### Data Table Page
Use:
- page header
- filter bar
- search
- table
- status tags
- row actions
- detail drawer
- bulk action if safe

### Detail Page
Use:
- title and status
- Descriptions
- Tabs
- activity log
- related records
- safe action buttons

### Form Page
Use:
- clear sections
- helper text
- inline validation
- required field markers
- sticky save button if long
- confirmation for sensitive action

### Review Workspace
Use:
- left list/table
- right drawer/detail
- feedback form
- status actions
- audit notes

## 9. Mobile Rules
Participant portal must be mobile-friendly:
- bottom navigation
- cards over tables
- minimal forms
- visible next-step CTA
- avoid dense table on mobile

Admin portal is desktop-first:
- tables and filters optimized for desktop
- mobile only for monitoring and quick actions

## 10. Empty States
Empty states should be helpful, not just "No data".

Examples:
- "Belum ada tugas. Tugas baru akan tampil di sini setelah pengajar menerbitkannya."
- "Belum ada program aktif. Silakan hubungi admin jika Anda sudah mendaftar."
- "Belum ada setoran Qur'an yang dicatat."
- "Belum ada tiket bantuan."

## 11. Error States
Show clear errors:
- upload failed
- file type not allowed
- unauthorized access
- session expired
- RLS denied action
- missing required data
- email failed to send

## 12. Important UX Constraints
- No audio/video upload UI in MVP.
- No AI UI in MVP.
- No complicated chart unless it helps action.
- Do not expose technical terms like RLS, Edge Function, UUID to normal users.
- Use clear human labels.
