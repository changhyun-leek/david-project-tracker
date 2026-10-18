begin;
-- 기존 기록은 모두 관리자가 직접 누른 것이므로 확정으로 둔다. 새 기록은 기본 미확정.
alter table public.david_checks add column if not exists confirmed boolean not null default true;
alter table public.david_checks alter column confirmed set default false;
-- 참가자가 직접 남긴 체크. 관리자가 확정하기 전까지 참고용으로만 쓴다.
alter table public.david_checks add column if not exists self_qt boolean not null default false;
alter table public.david_checks add column if not exists self_exercise boolean not null default false;
alter table public.david_checks add column if not exists self_at timestamptz;
commit;
