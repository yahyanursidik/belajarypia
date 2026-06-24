# ACCEPTANCE_CRITERIA.md
# Acceptance Criteria for YPIA LMS MVP

## 1. Global Acceptance Criteria
- App builds successfully.
- App uses Vite + React + TypeScript + Refine + Ant Design.
- User-facing labels are in Indonesian.
- Unauthenticated users cannot access protected pages.
- Role-based navigation works.
- Sensitive tables have RLS.
- No AI feature appears in MVP.
- No audio/video upload is allowed in MVP.
- File upload supports only approved non-audio/video types.
- All sensitive file access uses signed URLs.

---

## 2. Auth and RBAC
### Must Pass
- User can login.
- User can logout.
- User can reset password.
- User sees dashboard based on role.
- User cannot open unauthorized route.
- Menu items are hidden when permission is missing.

---

## 3. Organization and Unit
### Must Pass
- Superadmin can create organization/unit.
- Superadmin can assign admin to unit.
- Admin sees only assigned unit/programs.
- Program is linked to unit.

---

## 4. Registration and Admission
### Must Pass
- Public user can open program registration form.
- Public user can submit registration.
- Applicant record is created.
- Admin can view applicant list.
- Admin can open applicant detail drawer/page.
- Admin can change status: submitted, under_review, revision_requested, accepted, rejected.
- Participant is not created before applicant is accepted.
- Placement result can be recorded manually.

---

## 5. Participant and Guardian
### Must Pass
- Accepted applicant can become participant.
- Global participant number is unique.
- Participant profile is created.
- Guardian relation can be created if needed.
- Guardian can only access linked child.

---

## 6. Enrollment
### Must Pass
- Enrollment can be created for participant.
- Enrollment can be assigned to program/batch/class/halaqah.
- Enrollment status can change.
- Enrollment status changes are logged.
- Payment hold prevents access when payment rule requires it.
- Active enrollment allows access to program content.

---

## 7. Onboarding
### Must Pass
- Onboarding checklist appears after enrollment.
- Participant can mark onboarding steps.
- Admin can view incomplete onboarding.
- WhatsApp group link appears only when:
  - program uses WhatsApp group,
  - enrollment is active,
  - group mapping exists.
- Welcome email/log is triggered.

---

## 8. Program and Curriculum
### Must Pass
- Admin can create program.
- Admin can create batch.
- Admin can create class.
- Admin can create halaqah.
- Admin/teacher can create modules and lessons.
- Lesson can be draft/published.
- Lesson can have release date.
- Participant only sees published and accessible lessons.

---

## 9. Document Content
### Must Pass
- Teacher/admin can create text lesson content.
- Teacher/admin can upload approved document/image file.
- Audio/video upload is rejected in frontend.
- Audio/video upload is rejected in backend/Edge Function.
- File metadata is stored.
- File is private.
- Signed download URL validates access.

---

## 10. Assignment and Submission
### Must Pass
- Teacher/admin can create assignment.
- Participant can submit text assignment.
- Participant can submit document/image if enabled.
- Participant can submit checklist/journal if enabled.
- Teacher can review submission.
- Teacher can request revision.
- Teacher can finalize review.
- Participant can see feedback.
- Attempt number is stored.

---

## 11. Qur'an Manual Review
### Must Pass
- Teacher/mentor can create Qur'an target.
- Participant can see Qur'an target.
- Teacher/mentor can create manual setoran record.
- Setoran record includes target type, surah/ayah, date, status, and notes.
- Teacher/mentor can add tajwid notes.
- Participant can see review result.
- Progress summary updates.

### Must Not Happen
- Participant cannot upload audio/video setoran in MVP.

---

## 12. Live Session and Attendance
### Must Pass
- Admin/teacher can create live session.
- Participant can see session if enrolled.
- Teacher can record attendance.
- Attendance status supports hadir, izin, sakit, alfa, terlambat.
- Admin can view attendance report.
- Recording is external link only if needed.

---

## 13. Assessment and Rubric
### Must Pass
- Teacher can create rubric.
- Teacher can assess submission or Qur'an setoran.
- Participant can see score/feedback.
- Finalized assessment cannot be changed without special permission.

---

## 14. Discussion and Mentoring
### Must Pass
- Participant can post in allowed discussion.
- Teacher/admin can moderate discussion.
- Mentor can create mentor note for assigned participant.
- Mentor notes are not visible to unauthorized users.
- Announcement can be scoped to program/class.

---

## 15. Finance
### Must Pass
- Invoice can be created.
- Participant can see own invoice.
- Participant can upload payment proof document/image.
- Finance can verify payment.
- Payment verified can activate enrollment.
- Payment pending can hold enrollment if rule requires it.
- Payment proof audio/video is rejected.

---

## 16. Certificate
### Must Pass
- Certificate eligibility can be checked.
- Certificate number is unique.
- Certificate can be issued only when rules are fulfilled.
- Participant can see issued certificate.
- Certificate file is stored as document.

---

## 17. Helpdesk
### Must Pass
- User can create ticket.
- Helpdesk can reply.
- Ticket status can change.
- User can view own ticket.
- Admin/helpdesk can filter tickets by status/category.

---

## 18. Notifications
### Must Pass
- Notification log is created for important events.
- Failed notification is logged.
- Admin can view failed logs.
- Template supports variables like name, program, participant number, login link.

---

## 19. Feature Flags and Readiness
### Must Pass
- Program feature flags can be set.
- Disabled features do not appear in participant UI.
- Program readiness checklist shows missing setup.
- Program cannot publish if required readiness checks fail.

---

## 20. Definition of Done per Codex Task
Each task is done only when:
- Scope requested is implemented.
- No out-of-scope modules were added.
- Lint/build/typecheck runs successfully if available.
- Files changed are summarized.
- Any assumptions are documented.
- Any known limitations are reported.
