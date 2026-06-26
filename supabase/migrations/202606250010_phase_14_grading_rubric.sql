-- Migration: Adding Grading Rubric to Programs

alter table public.programs add column if not exists grading_rubric jsonb default '[
  {"min_score": 90, "max_score": 100, "label": "Mumtaz (Istimewa)"},
  {"min_score": 80, "max_score": 89.9, "label": "Jayyid Jiddan (Baik Sekali)"},
  {"min_score": 65, "max_score": 79.9, "label": "Jayyid (Baik)"},
  {"min_score": 40, "max_score": 64.9, "label": "Maqbul (Cukup)"},
  {"min_score": 0, "max_score": 39.9, "label": "Rasib (Gagal/Mengulang)"}
]'::jsonb;
