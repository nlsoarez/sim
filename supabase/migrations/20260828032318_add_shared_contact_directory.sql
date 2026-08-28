create table if not exists public.sim_contact_directory (
  id smallint primary key default 1 check (id = 1),
  contact_store jsonb not null default '{}'::jsonb,
  source_file_name text not null,
  updated_by uuid not null default auth.uid() references public.sim_profiles(user_id),
  updated_at timestamptz not null default now(),
  constraint sim_contact_directory_store_object check (jsonb_typeof(contact_store) = 'object'),
  constraint sim_contact_directory_source_name check (char_length(source_file_name) between 1 and 255),
  constraint sim_contact_directory_store_size check (pg_column_size(contact_store) <= 5242880)
);

create index if not exists sim_contact_directory_updated_by_idx
  on public.sim_contact_directory(updated_by);

alter table public.sim_contact_directory enable row level security;

drop policy if exists "Active users can read contact directory" on public.sim_contact_directory;
create policy "Active users can read contact directory"
  on public.sim_contact_directory
  for select
  to authenticated
  using (sim_private.is_active());

drop policy if exists "Admins can insert contact directory" on public.sim_contact_directory;
create policy "Admins can insert contact directory"
  on public.sim_contact_directory
  for insert
  to authenticated
  with check (sim_private.is_admin() and updated_by = (select auth.uid()));

drop policy if exists "Admins can update contact directory" on public.sim_contact_directory;
create policy "Admins can update contact directory"
  on public.sim_contact_directory
  for update
  to authenticated
  using (sim_private.is_admin())
  with check (sim_private.is_admin() and updated_by = (select auth.uid()));

revoke all on table public.sim_contact_directory from anon;
revoke all on table public.sim_contact_directory from authenticated;
grant select, insert, update on table public.sim_contact_directory to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sim_contact_directory'
  ) then
    alter publication supabase_realtime add table public.sim_contact_directory;
  end if;
end
$$;
