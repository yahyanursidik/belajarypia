# AGENTS.md

## Project
YPIA Learning Management System  
Yayasan Pendidikan Ihsanul Adab

## Product Goal
Build a flexible LMS for Islamic education and parenting programs, including Qur'an learning, kitab/matan classes, Arabic classes, parenting classes, cohort-based classes, level-based learning, halaqah-based learning, assignment review, onboarding, attendance, and progress tracking.

## Stack
- Vite
- React
- TypeScript
- Refine
- shadcn/ui
- Tailwind CSS
- Supabase Auth
- Supabase PostgreSQL
- Supabase Row Level Security
- Supabase Edge Functions
- Contabo S3-compatible Object Storage for documents only
- Vercel deployment

## Important MVP Decisions
- Do not implement AI Assist Layer in MVP.
- Do not implement audio/video upload in MVP.
- Do not implement native mobile app in MVP.
- Do not implement payment gateway in MVP.
- Use shadcn/ui and Tailwind CSS as the main UI component system.
- Use Refine headless for resource-based admin, teacher, and operational workflows.
- Use custom React pages when learner experience needs to be simpler than CRUD.
- Use Indonesian language for all user-facing labels, menus, statuses, empty states, and validation messages.

## Storage Rules
Contabo S3 is used only for non-audio/video files:
- PDF
- DOCX
- XLSX
- PPTX
- JPG
- PNG
- WebP
- certificates
- payment proof documents/images
- general administrative documents

Reject these file types in frontend and backend:
- MP3
- M4A
- WAV
- MP4
- MOV
- AVI
- MKV
- any other audio/video file type

Never expose S3 secrets in frontend. Use Supabase Edge Functions for signed upload/download URLs.

## Security Rules
- Enable RLS on sensitive tables.
- Do not rely only on frontend permission checks.
- Business-critical operations must go through Supabase Edge Functions or secure SQL functions.
- Never hardcode secrets.
- Use environment variables.
- Add audit logs for sensitive actions.
- Always validate user role and scope in backend logic or database policies.

## UI Rules
- Use shadcn/ui-style local components and Tailwind CSS utilities.
- Keep UI clean, warm, professional, and easy to use.
- Admin pages may be dense but must remain readable.
- Learner pages must be simple, guided, and mobile-friendly.
- Use consistent status tags and badges.
- Use clear empty states and actionable messages.
- Keep shared UI components in `src/components/ui` and avoid one-off styling when an existing local UI primitive fits.

## Development Rules
- Work in small phases.
- Do not implement modules outside the requested phase.
- Before coding, explain files that will be changed.
- After coding, run lint/build/typecheck if available.
- Provide a summary of changes and remaining tasks.
- Keep code modular and typed.
- Prefer clear folder structure over clever abstractions.
- Do not introduce new dependencies without explaining why.

## Required Project Docs
Read these files before implementing:
- docs/PRD.md
- docs/STACK.md
- docs/ROADMAP.md
- docs/DATABASE_SCHEMA.md
- docs/RLS_POLICY_PLAN.md
- docs/UI_UX_GUIDE.md
- docs/MODULES.md
- docs/ACCEPTANCE_CRITERIA.md
- docs/PROMPT_LOG.md

## Default Commands
When available, run:
```bash
npm run lint
npm run typecheck
npm run build
```

## Forbidden in MVP
- AI Assist Layer
- Audio upload
- Video upload
- Payment gateway integration
- Native mobile app
- Advanced workflow automation builder
- LTI integration
- xAPI/LRS implementation
