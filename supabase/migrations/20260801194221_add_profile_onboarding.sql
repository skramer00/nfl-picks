alter table public.profiles
add column if not exists onboarding_completed_at timestamptz;

-- Preserve the current experience for accounts that predate onboarding.
update public.profiles
set onboarding_completed_at = now()
where onboarding_completed_at is null;

grant update (onboarding_completed_at) on public.profiles to authenticated;
