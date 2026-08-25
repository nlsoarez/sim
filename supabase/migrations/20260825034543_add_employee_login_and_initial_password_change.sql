-- Logins por matrícula e troca obrigatória da senha inicial no SIM.

alter table public.sim_profiles
  add column login_id text,
  add column must_change_password boolean not null default false;

alter table public.sim_profiles
  add constraint sim_profiles_login_id_check
    check (login_id is null or login_id ~ '^[A-Z][0-9]{6,7}$');

create unique index sim_profiles_login_id_key
  on public.sim_profiles (login_id)
  where login_id is not null;

create or replace function sim_private.is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.sim_profiles profile
        where profile.user_id = (select auth.uid())
          and profile.active
          and not profile.must_change_password
    );
$$;

create or replace function sim_private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.sim_profiles profile
        where profile.user_id = (select auth.uid())
          and profile.active
          and not profile.must_change_password
          and profile.role = 'admin'
    );
$$;

revoke all on function sim_private.is_active() from public, anon;
revoke all on function sim_private.is_admin() from public, anon;
grant execute on function sim_private.is_active() to authenticated;
grant execute on function sim_private.is_admin() to authenticated;

create or replace function sim_private.clear_initial_password_requirement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if old.encrypted_password is distinct from new.encrypted_password then
        update public.sim_profiles
        set must_change_password = false,
            updated_at = now()
        where user_id = new.id
          and must_change_password;
    end if;
    return new;
end;
$$;

revoke all on function sim_private.clear_initial_password_requirement()
  from public, anon, authenticated;

drop trigger if exists sim_clear_initial_password_requirement on auth.users;
create trigger sim_clear_initial_password_requirement
after update of encrypted_password on auth.users
for each row execute function sim_private.clear_initial_password_requirement();

-- As contas iniciais são provisionadas diretamente no ambiente administrativo.
-- Matrículas, nomes e senhas não são armazenados no repositório público.
