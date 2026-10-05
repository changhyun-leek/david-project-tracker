begin;

create table if not exists public.david_participants (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('student','teacher')),
  source_id uuid not null,
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (kind, source_id)
);
create table if not exists public.david_aliases (
  alias text primary key,
  participant_id uuid not null references public.david_participants(id) on delete restrict
);
create table if not exists public.david_messages (
  fingerprint char(64) primary key,
  room text not null,
  sender text not null,
  sent_at timestamptz not null,
  assigned_date date not null,
  media_kind text not null check (media_kind in ('photo','video','text')),
  excerpt text not null default '',
  participant_id uuid references public.david_participants(id) on delete set null,
  created_at timestamptz not null default now(),
  check (assigned_date between date '2026-10-04' and date '2026-10-31')
);
create index if not exists david_messages_by_day on public.david_messages(assigned_date, participant_id);
create table if not exists public.david_checks (
  participant_id uuid not null references public.david_participants(id) on delete restrict,
  day date not null check (day between date '2026-10-04' and date '2026-10-31'),
  qt_done boolean not null default false,
  exercise_done boolean not null default false,
  note text not null default '',
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key(participant_id,day)
);

alter table public.david_participants enable row level security;
alter table public.david_aliases enable row level security;
alter table public.david_messages enable row level security;
alter table public.david_checks enable row level security;
revoke all on public.david_participants, public.david_aliases, public.david_messages, public.david_checks from anon, authenticated;

commit;

