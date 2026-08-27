-- JuaLink schema — phase 4 SMS artisan onboarding

create table if not exists sms_artisan_onboarding_sessions (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null,
  current_step text not null,
  application_data jsonb not null default '{}'::jsonb,
  completed boolean not null default false,
  cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists sms_artisan_onboarding_phone_uidx
  on sms_artisan_onboarding_sessions (phone_number)
  where completed = false and cancelled = false;

drop trigger if exists sms_artisan_onboarding_set_updated_at on sms_artisan_onboarding_sessions;

create trigger sms_artisan_onboarding_set_updated_at
  before update on sms_artisan_onboarding_sessions
  for each row execute function set_updated_at();

alter table sms_artisan_onboarding_sessions enable row level security;

create policy "sms_artisan_onboarding_admin_only" on sms_artisan_onboarding_sessions
  for all using (is_admin()) with check (is_admin());
