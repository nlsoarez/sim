-- Public registration requests remain blocked until an active SIM administrator approves them.

create table if not exists public.sim_registration_requests (
    user_id uuid primary key references public.sim_profiles(user_id) on delete cascade,
    email text not null check (char_length(email) between 3 and 320),
    status text not null default 'pending' check (status in ('pending', 'approved')),
    requested_at timestamptz not null default now(),
    reviewed_at timestamptz,
    reviewed_by uuid references public.sim_profiles(user_id)
);

alter table public.sim_registration_requests enable row level security;

drop policy if exists "sim_registration_requests_read_own_or_admin" on public.sim_registration_requests;
create policy "sim_registration_requests_read_own_or_admin"
on public.sim_registration_requests for select
to authenticated
using (user_id = (select auth.uid()) or sim_private.is_admin());

grant select on public.sim_registration_requests to authenticated;
revoke all on public.sim_registration_requests from anon;

drop policy if exists "sim_profiles_read_active_members" on public.sim_profiles;
create policy "sim_profiles_read_active_members"
on public.sim_profiles for select
to authenticated
using (
    user_id = (select auth.uid())
    or sim_private.is_admin()
    or (active and sim_private.is_active())
);

create or replace function sim_private.handle_new_sim_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    requested_name text;
    requested_group text;
begin
    requested_name := left(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), 120);
    if requested_name is null then
        requested_name := left(coalesce(nullif(split_part(new.email, '@', 1), ''), 'Novo usuario'), 120);
    end if;

    requested_group := left(coalesce(nullif(lower(btrim(new.raw_user_meta_data ->> 'group_id')), ''), 'residencial'), 80);

    insert into public.sim_profiles (user_id, display_name, role, group_id, active)
    values (new.id, requested_name, 'user', requested_group, false)
    on conflict (user_id) do nothing;

    insert into public.sim_registration_requests (user_id, email, status)
    values (new.id, lower(coalesce(new.email, '')), 'pending')
    on conflict (user_id) do update
    set email = excluded.email,
        status = 'pending',
        requested_at = now(),
        reviewed_at = null,
        reviewed_by = null;

    return new;
end;
$$;

revoke all on function sim_private.handle_new_sim_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_for_sim on auth.users;
create trigger on_auth_user_created_for_sim
after insert on auth.users
for each row execute function sim_private.handle_new_sim_user();

do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'sim_profiles'
    ) then
        alter publication supabase_realtime add table public.sim_profiles;
    end if;
end;
$$;
