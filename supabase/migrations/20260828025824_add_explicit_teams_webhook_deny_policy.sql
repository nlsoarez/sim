-- Make the client denial explicit. The Edge Function uses service_role, which
-- bypasses RLS, and receives only SELECT privilege on this table.
create policy "sim_teams_webhooks_deny_authenticated"
on public.sim_teams_webhooks
for select
to authenticated
using (false);
