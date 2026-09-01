alter table public.sim_messages
    drop constraint if exists sim_messages_target_type_check,
    drop constraint if exists sim_messages_target_check;

alter table public.sim_messages
    add constraint sim_messages_target_type_check
        check (target_type in ('all', 'group', 'user', 'users')),
    add constraint sim_messages_target_check check (
        (target_type = 'all' and target_user_id is null and target_group is null)
        or (target_type = 'group' and target_user_id is null and nullif(btrim(target_group), '') is not null)
        or (target_type = 'user' and target_user_id is not null and target_group is null)
        or (target_type = 'users' and target_user_id is null and target_group is null)
    );

create table if not exists public.sim_message_recipients (
    message_id uuid not null references public.sim_messages(id) on delete cascade,
    user_id uuid not null references public.sim_profiles(user_id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (message_id, user_id)
);

create index if not exists sim_message_recipients_user_idx
    on public.sim_message_recipients (user_id, created_at desc);

alter table public.sim_message_recipients enable row level security;

drop policy if exists "sim_message_recipients_read" on public.sim_message_recipients;
create policy "sim_message_recipients_read"
on public.sim_message_recipients for select
to authenticated
using (sim_private.is_admin() or user_id = (select auth.uid()));

drop policy if exists "sim_message_recipients_admin_insert" on public.sim_message_recipients;
create policy "sim_message_recipients_admin_insert"
on public.sim_message_recipients for insert
to authenticated
with check (
    sim_private.is_admin()
    and exists (
        select 1
        from public.sim_profiles profile
        where profile.user_id = user_id
          and profile.active
          and profile.role = 'user'
    )
);

drop policy if exists "sim_message_recipients_admin_delete" on public.sim_message_recipients;
create policy "sim_message_recipients_admin_delete"
on public.sim_message_recipients for delete
to authenticated
using (sim_private.is_admin());

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
            or (
                target_type = 'users'
                and exists (
                    select 1
                    from public.sim_message_recipients recipient
                    where recipient.message_id = sim_messages.id
                      and recipient.user_id = (select auth.uid())
                )
            )
        )
    )
);

grant select, insert, delete on public.sim_message_recipients to authenticated;
revoke all on public.sim_message_recipients from anon;

update storage.buckets
set allowed_mime_types = array[
    'application/pdf',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.rar'
]
where id = 'sim-documents';

do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'sim_message_recipients'
    ) then
        alter publication supabase_realtime add table public.sim_message_recipients;
    end if;
end
$$;
