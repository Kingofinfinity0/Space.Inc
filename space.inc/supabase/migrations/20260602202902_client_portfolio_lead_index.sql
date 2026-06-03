create index if not exists idx_client_account_profiles_lead_consultant
on public.client_account_profiles (lead_consultant_id)
where lead_consultant_id is not null;
