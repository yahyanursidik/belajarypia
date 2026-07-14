alter table public.system_settings
  add column if not exists app_sidebar_title text default 'YPIA',
  add column if not exists app_sidebar_subtitle text default 'Portal Pembelajaran',
  add column if not exists system_header_title text default 'Pusat Kendali Sistem',
  add column if not exists system_header_subtitle text default 'Tata Kelola & Pemantauan LMS';

update public.system_settings
set
  app_sidebar_title = coalesce(nullif(app_sidebar_title, ''), 'YPIA'),
  app_sidebar_subtitle = coalesce(nullif(app_sidebar_subtitle, ''), 'Portal Pembelajaran'),
  system_header_title = coalesce(nullif(system_header_title, ''), 'Pusat Kendali Sistem'),
  system_header_subtitle = coalesce(nullif(system_header_subtitle, ''), 'Tata Kelola & Pemantauan LMS');
