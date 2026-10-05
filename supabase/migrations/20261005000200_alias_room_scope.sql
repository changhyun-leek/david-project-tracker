begin;
alter table public.david_aliases add column if not exists room text not null default '*';
alter table public.david_aliases drop constraint if exists david_aliases_pkey;
alter table public.david_aliases add primary key(room, alias);
commit;
