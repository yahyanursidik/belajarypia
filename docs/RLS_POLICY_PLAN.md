# RLS_POLICY_PLAN.md
# Supabase Row Level Security Plan

## 1. Core Principle
Frontend access control is not enough. Supabase RLS must protect sensitive data at database level.

## 2. Role Model
Primary roles:
- super_admin
- admin
- teacher
- mentor
- participant
- guardian
- finance
- helpdesk
- content_reviewer

## 3. Scope Model
A user role may have a scope:
- global
- organization
- unit
- program
- batch
- class
- halaqah
- own

Stored in:
- user_roles.scope_type
- user_roles.scope_id

## 4. General Policy Rules
### Super Admin
Can view and manage all data.

### Admin
Can view and manage data under assigned unit/program.

### Teacher
Can view classes they teach and participant data related to those classes.

### Mentor
Can view halaqahs they mentor and participant data related to those halaqahs.

### Participant
Can view their own profile, enrollments, lessons, assignments, submissions, reviews, progress, invoices, certificates, notifications, and tickets.

### Guardian
Can view linked child participant data.

### Finance
Can view and manage invoices, payments, payment proofs, discounts, and scholarships. Finance should not manage academic content.

### Helpdesk
Can view tickets and limited user/enrollment context required to solve tickets.

## 5. Tables Requiring Strict RLS
- profiles
- participants
- guardians
- guardian_participants
- applicants
- enrollments
- submissions
- submission_files
- assessments
- quran_targets
- quran_setoran_records
- quran_reviews
- invoices
- payments
- payment_proofs
- certificates
- mentor_notes
- document_files
- helpdesk_tickets
- notifications
- audit_logs

## 6. Suggested Helper Functions
Create SQL helper functions to simplify policies.

### is_super_admin()
Returns true if current user has super_admin role.

### has_role(role_code text)
Returns true if current user has a role.

### has_scoped_access(scope_type text, scope_id uuid)
Returns true if user has matching access.

### is_participant_owner(participant_id uuid)
Returns true if current user owns participant record.

### is_guardian_of(participant_id uuid)
Returns true if current user is guardian of participant.

### is_teacher_of_class(class_id uuid)
Returns true if current user teaches class.

### is_mentor_of_halaqah(halaqah_id uuid)
Returns true if current user mentors halaqah.

### can_access_enrollment(enrollment_id uuid)
Returns true if user can access enrollment by role/scope.

## 7. Policy Patterns

### profiles
- User can view own profile.
- Super admin can view all.
- Admin can view profiles within scope.
- Helpdesk can view limited profile fields if connected to ticket.

### applicants
- Public insert may be allowed through secure RPC/Edge Function.
- Applicant status page should use secure token or authenticated access.
- Admin can view applicants in assigned program/unit.
- Super admin can view all.

### participants
- Participant can view own participant record.
- Guardian can view linked child.
- Teacher can view participants in assigned classes.
- Mentor can view participants in assigned halaqahs.
- Admin can view participants in scope.

### enrollments
- Participant can view own enrollments.
- Guardian can view child enrollments.
- Teacher can view class enrollments.
- Mentor can view halaqah enrollments.
- Admin can manage scope enrollments.
- Finance can view payment-related enrollment fields.

### lessons and contents
- Published lessons visible to participant if enrolled and release/prerequisite rules allow.
- Teacher can manage lessons in assigned class/program if permission exists.
- Admin can manage lessons in scope.

### document_files
- Owner can view own uploads.
- Participant can view document if related to own enrollment/lesson/submission.
- Teacher can view document if related to assigned class.
- Admin can view document in scope.
- Signed URL generation must also validate access server-side.

### submissions
- Participant can create/view own submission.
- Teacher can review submissions in assigned class.
- Mentor can review submissions in assigned halaqah if permitted.
- Admin can view scope submissions.

### quran_setoran_records
- Teacher/mentor can create records for assigned class/halaqah.
- Participant can view own Qur'an records.
- Guardian can view child's Qur'an records if parent portal enabled.
- Admin can view scope records.

### invoices/payments
- Participant can view own invoices.
- Guardian can view child invoices if applicable.
- Finance can manage invoices/payments.
- Admin can view payment status in scope but not necessarily all financial details.

### helpdesk_tickets
- User can view own ticket.
- Helpdesk can view assigned/open tickets.
- Admin can view tickets under program scope.
- Super admin can view all.

### audit_logs
- Super admin can view all.
- Admin can view limited logs in scope.
- Other roles should not access audit logs.

## 8. RLS Testing Checklist
For each major role, test:
- Can access own allowed records.
- Cannot access another participant's record.
- Cannot access other unit/program data.
- Cannot manipulate URL to access unauthorized data.
- Cannot download unauthorized document.
- Cannot update protected fields.
- Cannot change role/permission unless superadmin.

## 9. MVP RLS Priorities
Implement strict RLS first for:
1. profiles
2. participants
3. guardians
4. enrollments
5. applicants
6. lessons/lesson_contents
7. document_files
8. assignments/submissions
9. quran_setoran_records
10. invoices/payments
11. certificates
12. helpdesk_tickets
