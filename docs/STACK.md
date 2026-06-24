# STACK.md
# Technical Stack for YPIA LMS

## 1. Frontend
- Vite
- React
- TypeScript
- Refine
- shadcn/ui
- Tailwind CSS
- React Router
- Refine data/auth/access control providers
- Vercel for deployment

## 2. Backend / BaaS
- Supabase Auth
- Supabase PostgreSQL
- Supabase Row Level Security
- Supabase Edge Functions
- Supabase Realtime only if needed

## 3. Storage
- Contabo S3-compatible Object Storage
- Used only for non-audio/video documents and images
- File access via signed upload/download URLs generated server-side

## 4. UI Framework
Use shadcn/ui-style local components with Tailwind CSS as the main UI component system.

Recommended primitives:
- Button
- Card
- Badge
- Alert
- Input
- Select
- Checkbox
- Radio Group
- Form
- Table
- Dialog
- Sheet
- Tabs
- Separator
- Dropdown Menu
- Navigation Menu
- Breadcrumb
- Progress
- Skeleton
- Calendar
- Command

## 5. Refine Usage
Refine is used headlessly for:
- resource-based routing
- CRUD-heavy pages
- admin workspaces
- teacher workspaces
- data fetching
- auth integration
- access control
- notification integration
- resource and data orchestration without locking the UI to a component library

Refine should not force learner pages to look like admin CRUD pages. Use custom React pages for participant/guardian dashboards when needed.

## 6. Supabase Usage
Supabase is used for:
- authentication
- user profile
- database
- RLS
- Edge Functions
- secure server-side operations
- optional real-time updates

## 7. Edge Functions Usage
Use Edge Functions for:
- approve applicant
- convert applicant to participant
- create enrollment
- send onboarding email/log
- generate signed upload URL
- generate signed download URL
- verify payment
- record Qur'an setoran
- generate certificate
- refresh progress
- send notification

## 8. Contabo S3 Usage
Allowed file types:
- PDF
- DOCX
- XLSX
- PPTX
- JPG
- PNG
- WebP

Forbidden file types:
- MP3
- M4A
- WAV
- MP4
- MOV
- AVI
- MKV
- all audio/video MIME types

## 9. Deployment
Frontend:
- Vercel

Backend:
- Supabase project

Storage:
- Contabo Object Storage

Environment variables:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY only in server-side functions
- CONTABO_S3_ENDPOINT only in Edge Function/server-side environment
- CONTABO_S3_ACCESS_KEY only server-side
- CONTABO_S3_SECRET_KEY only server-side
- EMAIL_PROVIDER_API_KEY only server-side

## 10. Suggested Frontend Folder Structure
```text
src/
  app/
    providers/
      RefineProvider.tsx
      SupabaseProvider.tsx
      AuthProvider.ts
      AccessControlProvider.ts
      DataProvider.ts
  layouts/
    PublicLayout.tsx
    LearnerLayout.tsx
    TeacherLayout.tsx
    AdminLayout.tsx
    SuperAdminLayout.tsx
  routes/
    public/
    auth/
    learner/
    teacher/
    admin/
    super-admin/
  resources/
    applicants/
    participants/
    programs/
    enrollments/
    lessons/
    assignments/
    submissions/
    quran/
    finance/
    certificates/
    helpdesk/
  components/
    common/
    ui/
    tables/
    forms/
    dashboard/
    status/
    navigation/
  lib/
    supabase.ts
    permissions.ts
    storage.ts
    formatting.ts
    constants.ts
```

## 11. Non-Negotiable Technical Rules
- No audio/video upload in MVP.
- No AI implementation in MVP.
- No hardcoded secrets.
- RLS must protect sensitive tables.
- Frontend permission checks are not enough.
- All sensitive file access must use signed URLs.
- Business-critical operations must not be implemented only in frontend.
