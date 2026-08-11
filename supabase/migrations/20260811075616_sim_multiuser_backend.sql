-- SIM multi-user backend: authentication profiles, shared documents and messages.

create schema if not exists sim_private;
revoke all on schema sim_private from public, anon;
grant usage on schema sim_private to authenticated;

create table if not exists public.sim_profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    display_name text not null check (char_length(display_name) between 1 and 120),
    role text not null default 'user' check (role in ('admin', 'user')),
    group_id text not null default 'residencial' check (char_length(group_id) between 1 and 80),
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

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
          and profile.role = 'admin'
    );
$$;

revoke all on function sim_private.is_active() from public, anon;
revoke all on function sim_private.is_admin() from public, anon;
grant execute on function sim_private.is_active() to authenticated;
grant execute on function sim_private.is_admin() to authenticated;

create table if not exists public.sim_messages (
    id uuid primary key default gen_random_uuid(),
    sender_id uuid not null default auth.uid() references public.sim_profiles(user_id),
    target_type text not null check (target_type in ('all', 'group', 'user')),
    target_user_id uuid references public.sim_profiles(user_id),
    target_group text,
    title text not null check (char_length(title) between 1 and 160),
    body text not null default '' check (char_length(body) <= 5000),
    created_at timestamptz not null default now(),
    constraint sim_messages_target_check check (
        (target_type = 'all' and target_user_id is null and target_group is null)
        or (target_type = 'group' and target_user_id is null and nullif(btrim(target_group), '') is not null)
        or (target_type = 'user' and target_user_id is not null and target_group is null)
    )
);

create index if not exists sim_messages_created_at_idx on public.sim_messages (created_at desc);
create index if not exists sim_messages_sender_idx on public.sim_messages (sender_id);
create index if not exists sim_messages_target_user_idx on public.sim_messages (target_user_id) where target_user_id is not null;
create index if not exists sim_messages_target_group_idx on public.sim_messages (target_group) where target_group is not null;

create table if not exists public.sim_message_receipts (
    message_id uuid not null references public.sim_messages(id) on delete cascade,
    user_id uuid not null default auth.uid() references public.sim_profiles(user_id) on delete cascade,
    confirmed_at timestamptz not null default now(),
    primary key (message_id, user_id)
);

create index if not exists sim_message_receipts_user_idx on public.sim_message_receipts (user_id, confirmed_at desc);

create table if not exists public.sim_documents (
    id uuid primary key default gen_random_uuid(),
    title text not null check (char_length(title) between 1 and 160),
    file_name text not null check (char_length(file_name) between 1 and 255),
    storage_path text not null unique check (char_length(storage_path) between 1 and 500),
    mime_type text not null check (char_length(mime_type) between 1 and 160),
    size_bytes bigint not null check (size_bytes between 1 and 20971520),
    uploaded_by uuid not null default auth.uid() references public.sim_profiles(user_id),
    created_at timestamptz not null default now(),
    active boolean not null default true
);

create index if not exists sim_documents_created_at_idx on public.sim_documents (created_at desc);
create index if not exists sim_documents_uploaded_by_idx on public.sim_documents (uploaded_by);

alter table public.sim_profiles enable row level security;
alter table public.sim_messages enable row level security;
alter table public.sim_message_receipts enable row level security;
alter table public.sim_documents enable row level security;

drop policy if exists "sim_profiles_read_active_members" on public.sim_profiles;
create policy "sim_profiles_read_active_members"
on public.sim_profiles for select
to authenticated
using (sim_private.is_active());

drop policy if exists "sim_messages_read_visible" on public.sim_messages;
create policy "sim_messages_read_visible"
on public.sim_messages for select
to authenticated
using (
    sim_private.is_admin()
    or sender_id = (select auth.uid())
    or (
        sim_private.is_active()
        and (
            target_type = 'all'
            or (target_type = 'user' and target_user_id = (select auth.uid()))
            or (
                target_type = 'group'
                and target_group = (
                    select profile.group_id
                    from public.sim_profiles profile
                    where profile.user_id = (select auth.uid())
                      and profile.active
                )
            )
        )
    )
);

drop policy if exists "sim_messages_admin_insert" on public.sim_messages;
create policy "sim_messages_admin_insert"
on public.sim_messages for insert
to authenticated
with check (sim_private.is_admin() and sender_id = (select auth.uid()));

drop policy if exists "sim_messages_admin_delete" on public.sim_messages;
create policy "sim_messages_admin_delete"
on public.sim_messages for delete
to authenticated
using (sim_private.is_admin());

drop policy if exists "sim_receipts_read_own_or_admin" on public.sim_message_receipts;
create policy "sim_receipts_read_own_or_admin"
on public.sim_message_receipts for select
to authenticated
using (sim_private.is_admin() or user_id = (select auth.uid()));

drop policy if exists "sim_receipts_confirm_visible_message" on public.sim_message_receipts;
create policy "sim_receipts_confirm_visible_message"
on public.sim_message_receipts for insert
to authenticated
with check (
    sim_private.is_active()
    and user_id = (select auth.uid())
    and exists (
        select 1
        from public.sim_messages message
        where message.id = message_id
    )
);

drop policy if exists "sim_documents_read_active_members" on public.sim_documents;
create policy "sim_documents_read_active_members"
on public.sim_documents for select
to authenticated
using (sim_private.is_active() and active);

drop policy if exists "sim_documents_admin_insert" on public.sim_documents;
create policy "sim_documents_admin_insert"
on public.sim_documents for insert
to authenticated
with check (sim_private.is_admin() and uploaded_by = (select auth.uid()));

drop policy if exists "sim_documents_admin_update" on public.sim_documents;
create policy "sim_documents_admin_update"
on public.sim_documents for update
to authenticated
using (sim_private.is_admin())
with check (sim_private.is_admin());

drop policy if exists "sim_documents_admin_delete" on public.sim_documents;
create policy "sim_documents_admin_delete"
on public.sim_documents for delete
to authenticated
using (sim_private.is_admin());

grant select on public.sim_profiles to authenticated;
grant select, insert, delete on public.sim_messages to authenticated;
grant select, insert on public.sim_message_receipts to authenticated;
grant select, insert, update, delete on public.sim_documents to authenticated;

revoke all on public.sim_profiles, public.sim_messages, public.sim_message_receipts, public.sim_documents from anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'sim-documents',
    'sim-documents',
    false,
    20971520,
    array[
        'application/pdf',
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "sim_documents_storage_read" on storage.objects;
create policy "sim_documents_storage_read"
on storage.objects for select
to authenticated
using (bucket_id = 'sim-documents' and sim_private.is_active());

drop policy if exists "sim_documents_storage_admin_insert" on storage.objects;
create policy "sim_documents_storage_admin_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'sim-documents' and sim_private.is_admin());

drop policy if exists "sim_documents_storage_admin_update" on storage.objects;
create policy "sim_documents_storage_admin_update"
on storage.objects for update
to authenticated
using (bucket_id = 'sim-documents' and sim_private.is_admin())
with check (bucket_id = 'sim-documents' and sim_private.is_admin());

drop policy if exists "sim_documents_storage_admin_delete" on storage.objects;
create policy "sim_documents_storage_admin_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'sim-documents' and sim_private.is_admin());

-- Reuse the two existing authenticated administrators from the madrugada project.
insert into public.sim_profiles (user_id, display_name, role, group_id, active)
select
    user_record.id,
    case lower(user_record.email)
        when 'nelson.soares@claro.com.br' then 'Nelson Leandro'
        when 'kelly.lira@claro.com.br' then 'Kelly Lira'
    end,
    'admin',
    'residencial',
    true
from auth.users user_record
where lower(user_record.email) in ('nelson.soares@claro.com.br', 'kelly.lira@claro.com.br')
on conflict (user_id) do update
set display_name = excluded.display_name,
    role = 'admin',
    active = true,
    updated_at = now();

do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sim_messages'
    ) then
        alter publication supabase_realtime add table public.sim_messages;
    end if;
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sim_message_receipts'
    ) then
        alter publication supabase_realtime add table public.sim_message_receipts;
    end if;
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sim_documents'
    ) then
        alter publication supabase_realtime add table public.sim_documents;
    end if;
end;
$$;
