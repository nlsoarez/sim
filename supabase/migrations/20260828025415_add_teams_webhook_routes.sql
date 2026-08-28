-- Secret Teams Workflow routes. Values are provisioned administratively and
-- never committed to this public repository.
create table public.sim_teams_webhooks (
    route_key text primary key,
    recipient_name text not null,
    webhook_url text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint sim_teams_webhooks_route_key_check check (
        route_key = 'all' or route_key ~ '^[A-Z][0-9]{6,7}$'
    ),
    constraint sim_teams_webhooks_recipient_name_check check (
        length(btrim(recipient_name)) between 1 and 120
    ),
    constraint sim_teams_webhooks_url_check check (
        webhook_url ~ '^https://[^/]+\.environment\.api\.powerplatform\.com(?::443)?/powerautomate/'
    )
);

alter table public.sim_teams_webhooks enable row level security;
alter table public.sim_teams_webhooks force row level security;

revoke all on table public.sim_teams_webhooks from public, anon, authenticated;
grant select on table public.sim_teams_webhooks to service_role;

comment on table public.sim_teams_webhooks is
    'Private routing configuration used only by the authenticated SIM Teams Edge Function.';
