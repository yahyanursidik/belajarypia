-- Board lesson: a private, card-based learning surface for text and images.

create table if not exists public.lesson_boards (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null unique references public.lessons(id) on delete cascade,
  layout text not null default 'wall' check (layout in ('wall', 'columns')),
  title text,
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lesson_board_columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.lesson_boards(id) on delete cascade,
  title text not null,
  order_no int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lesson_board_posts (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.lesson_boards(id) on delete cascade,
  column_id uuid references public.lesson_board_columns(id) on delete set null,
  title text,
  body text,
  image_object_key text,
  image_mime_type text,
  image_alt text,
  order_no int not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_board_posts_content_check check (
    nullif(trim(coalesce(title, '')), '') is not null
    or nullif(trim(coalesce(body, '')), '') is not null
    or image_object_key is not null
  )
);

create index if not exists lesson_board_columns_board_order_idx
on public.lesson_board_columns(board_id, order_no);

create index if not exists lesson_board_posts_board_column_order_idx
on public.lesson_board_posts(board_id, column_id, order_no);

create or replace function public.assert_lesson_board_lesson_type()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.lessons lesson
    where lesson.id = new.lesson_id and lesson.lesson_type = 'board'
  ) then
    raise exception 'Board hanya dapat dibuat untuk lesson dengan tipe board.';
  end if;
  return new;
end;
$$;

create or replace function public.assert_lesson_board_post_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.column_id is not null and not exists (
    select 1 from public.lesson_board_columns column_row
    where column_row.id = new.column_id and column_row.board_id = new.board_id
  ) then
    raise exception 'Kolom kartu harus berada pada board yang sama.';
  end if;
  return new;
end;
$$;

drop trigger if exists lesson_boards_validate_lesson_type on public.lesson_boards;
create trigger lesson_boards_validate_lesson_type
before insert or update of lesson_id on public.lesson_boards
for each row execute function public.assert_lesson_board_lesson_type();

drop trigger if exists lesson_board_posts_validate_column on public.lesson_board_posts;
create trigger lesson_board_posts_validate_column
before insert or update of board_id, column_id on public.lesson_board_posts
for each row execute function public.assert_lesson_board_post_column();

drop trigger if exists lesson_boards_set_updated_at on public.lesson_boards;
create trigger lesson_boards_set_updated_at
before update on public.lesson_boards
for each row execute function public.set_updated_at();

drop trigger if exists lesson_board_columns_set_updated_at on public.lesson_board_columns;
create trigger lesson_board_columns_set_updated_at
before update on public.lesson_board_columns
for each row execute function public.set_updated_at();

drop trigger if exists lesson_board_posts_set_updated_at on public.lesson_board_posts;
create trigger lesson_board_posts_set_updated_at
before update on public.lesson_board_posts
for each row execute function public.set_updated_at();

create or replace function public.can_manage_lesson_board(target_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.lesson_boards board
    where board.id = target_board_id
      and public.can_manage_lesson_content(board.lesson_id)
  );
$$;

create or replace function public.get_lesson_board_image_for_download(p_post_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_object_key text;
begin
  if auth.uid() is null then
    raise exception 'Sesi pengguna tidak ditemukan.';
  end if;

  select post.image_object_key
  into v_object_key
  from public.lesson_board_posts post
  join public.lesson_boards board on board.id = post.board_id
  where post.id = p_post_id
    and post.image_object_key is not null
    and public.can_access_lesson(board.lesson_id);

  if v_object_key is null then
    raise exception 'Anda tidak memiliki akses ke gambar board ini.';
  end if;

  return v_object_key;
end;
$$;

revoke all on function public.can_manage_lesson_board(uuid) from public;
revoke all on function public.get_lesson_board_image_for_download(uuid) from public;
grant execute on function public.can_manage_lesson_board(uuid) to authenticated;
grant execute on function public.get_lesson_board_image_for_download(uuid) to authenticated;

alter table public.lesson_boards enable row level security;
alter table public.lesson_board_columns enable row level security;
alter table public.lesson_board_posts enable row level security;

drop policy if exists "lesson_boards_select_accessible" on public.lesson_boards;
create policy "lesson_boards_select_accessible"
on public.lesson_boards for select to authenticated
using (public.can_access_lesson(lesson_id));

drop policy if exists "lesson_boards_manage_staff" on public.lesson_boards;
create policy "lesson_boards_manage_staff"
on public.lesson_boards for all to authenticated
using (public.can_manage_lesson_content(lesson_id))
with check (public.can_manage_lesson_content(lesson_id));

drop policy if exists "lesson_board_columns_select_accessible" on public.lesson_board_columns;
create policy "lesson_board_columns_select_accessible"
on public.lesson_board_columns for select to authenticated
using (
  exists (
    select 1 from public.lesson_boards board
    where board.id = lesson_board_columns.board_id
      and public.can_access_lesson(board.lesson_id)
  )
);

drop policy if exists "lesson_board_columns_manage_staff" on public.lesson_board_columns;
create policy "lesson_board_columns_manage_staff"
on public.lesson_board_columns for all to authenticated
using (public.can_manage_lesson_board(board_id))
with check (public.can_manage_lesson_board(board_id));

drop policy if exists "lesson_board_posts_select_accessible" on public.lesson_board_posts;
create policy "lesson_board_posts_select_accessible"
on public.lesson_board_posts for select to authenticated
using (
  exists (
    select 1 from public.lesson_boards board
    where board.id = lesson_board_posts.board_id
      and public.can_access_lesson(board.lesson_id)
  )
);

drop policy if exists "lesson_board_posts_manage_staff" on public.lesson_board_posts;
create policy "lesson_board_posts_manage_staff"
on public.lesson_board_posts for all to authenticated
using (public.can_manage_lesson_board(board_id))
with check (public.can_manage_lesson_board(board_id));
