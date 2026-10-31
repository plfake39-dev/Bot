-- Run this in Supabase Dashboard > SQL Editor.
create table if not exists public.posts (
  id bigint generated always as identity primary key,
  title text,
  body text not null check (char_length(body) between 1 and 5000),
  language text not null default 'en',
  created_at timestamptz not null default now()
);

alter table public.posts enable row level security;

-- Public visitors can read posts and submit new posts without an account.
create policy "Anyone can read posts"
on public.posts for select
to anon, authenticated
using (true);

create policy "Anyone can create posts"
on public.posts for insert
to anon, authenticated
with check (
  char_length(body) between 1 and 5000
  and (title is null or char_length(title) <= 120)
  and language in ('en','bn','es','fr','hi','ar')
);

grant select, insert on public.posts to anon, authenticated;
grant usage, select on sequence public.posts_id_seq to anon, authenticated;

-- Optional: basic index for newest-first feed
create index if not exists posts_created_at_idx on public.posts (created_at desc);
