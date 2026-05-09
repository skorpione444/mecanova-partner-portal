alter table public.statuses add column if not exists icon text;
alter table public.statuses add column if not exists hide_from_list boolean not null default false;
