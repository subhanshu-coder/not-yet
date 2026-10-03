create table if not exists public.sessions (
  id uuid primary key,
  topic text not null check (char_length(topic) <= 240),
  category text not null default 'General',
  duration integer not null default 0 check (duration >= 0 and duration <= 3600),
  notes text not null default '',
  created_at timestamptz not null default now(),
  mime_type text not null,
  audio_path text not null unique
);

alter table public.sessions enable row level security;
revoke all on table public.sessions from anon, authenticated;
grant all on table public.sessions to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'session-audio',
  'session-audio',
  false,
  52428800,
  array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/wav', 'audio/mpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
