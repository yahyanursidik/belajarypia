# MODULES.md
# LMS Module Plan

## 1. Identity, Auth, Role, and Access
### Purpose
Manage authentication, profile, role, and access control.

### Features
- login/logout
- reset password
- profile
- roles
- permissions
- scoped access
- role-based menus

### MVP
Included.

---

## 2. Organization and Unit Management
### Purpose
Manage foundation/unit structure.

### Features
- organizations
- units
- unit admins
- unit program filtering

### MVP
Included basic.

---

## 3. Registration and Admission
### Purpose
Manage applicant registration and review.

### Features
- public registration
- dynamic form
- applicant list
- applicant detail
- status workflow
- manual placement notes
- approve/reject/request revision

### MVP
Included.

---

## 4. Participant and Guardian Management
### Purpose
Manage participant identity and guardian relation.

### Features
- participant profile
- global participant number
- guardian relation
- participant status
- enrollment history

### MVP
Included basic.

---

## 5. Enrollment Management
### Purpose
Connect participant to program, batch, class, halaqah, level, and track.

### Features
- create enrollment
- assign batch/class/halaqah
- payment status
- enrollment status
- hold/release
- enrollment logs

### MVP
Included.

---

## 6. Onboarding and Orientation
### Purpose
Guide new participants into program.

### Features
- welcome email/log
- onboarding checklist
- WhatsApp group link
- adab group
- program guide
- onboarding status

### MVP
Included.

---

## 7. Program and Curriculum Builder
### Purpose
Create flexible learning structure.

### Features
- program
- curriculum model
- level
- track
- module
- lesson
- prerequisite
- release schedule
- clone/template basic

### MVP
Included basic.

---

## 8. Learning Content and Document Library
### Purpose
Manage lessons and learning documents.

### Features
- rich text content
- PDF/document upload
- image upload
- external link
- document library
- versioning basic
- signed URL

### MVP
Included.

### Not Included
- audio upload
- video upload

---

## 9. Assignment, Submission, and Evidence of Learning
### Purpose
Manage learning tasks and participant submissions.

### Features
- text assignment
- document submission
- image submission if enabled
- checklist submission
- journal submission
- feedback
- resubmission

### MVP
Included.

### Not Included
- audio submission
- video submission

---

## 10. Qur'an Learning Engine
### Purpose
Support tahsin, tahfizh, ziyadah, murojaah, tasmi, and manual setoran review.

### Features
- Qur'an targets
- manual setoran records
- tajwid notes
- fluency notes
- memorization notes
- next action
- progress per surah/ayah
- review templates

### MVP
Included.

### Important
No audio/video upload. Setoran is performed in live/offline session and recorded manually.

---

## 11. Live Session and Attendance
### Purpose
Manage live sessions and attendance.

### Features
- session schedule
- Zoom/Meet link
- attendance grid
- session notes
- external recording link

### MVP
Included.

---

## 12. Assessment and Rubric
### Purpose
Manage evaluation and feedback.

### Features
- rubrics
- criteria
- assessment
- score
- feedback
- finalized status

### MVP
Included basic.

---

## 13. Progress and Analytics
### Purpose
Show progress for participant, teacher, and admin.

### Features
- participant progress
- class progress
- onboarding progress
- attendance summary
- submission summary
- Qur'an progress
- risk flags basic

### MVP
Included basic.

---

## 14. Discussion, Community, and Mentoring
### Purpose
Support learning discussion and mentoring.

### Features
- discussion threads
- posts
- moderation
- pinned posts
- mentor notes
- announcements

### MVP
Included basic.

---

## 15. Finance and Payment Status
### Purpose
Manage simple invoice and payment status.

### Features
- invoices
- payment proof document/image
- manual verification
- discount
- scholarship
- hold/release enrollment

### MVP
Included basic.

### Not Included
- payment gateway
- full accounting

---

## 16. Certification
### Purpose
Issue certificates based on completion rules.

### Features
- certificate templates
- certificate rules
- certificate number
- certificate issuing
- certificate document

### MVP
Should-have / basic.

---

## 17. Helpdesk
### Purpose
Support users.

### Features
- tickets
- messages
- categories
- status
- assignment
- FAQ

### MVP
Included basic.

---

## 18. Notification and Communication
### Purpose
Send and track notifications.

### Features
- welcome email
- reminder
- announcement
- notification logs
- resend failed notification
- templates

### MVP
Included basic.

---

## 19. Feature Flags and Program Readiness
### Purpose
Keep program setup flexible.

### Feature Flags
- use_payment
- use_whatsapp_group
- use_quran_engine
- use_forum
- use_certificate
- use_live_session
- use_parent_portal
- use_assignment
- use_attendance
- use_document_upload
- use_ai_assist default false
- use_audio_submission default false
- use_video_submission default false

### MVP
Included basic.

---

## 20. Excluded MVP Modules
- AI Assist Layer
- Audio/video upload
- Payment gateway
- Native mobile app
- Advanced workflow automation
- LTI integration
- LRS/xAPI
- Advanced academic supervision
