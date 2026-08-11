create index if not exists sim_registration_requests_reviewed_by_idx
on public.sim_registration_requests (reviewed_by)
where reviewed_by is not null;
