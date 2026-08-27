-- JuaLink schema — phase 3
-- Adds: automatic profile creation on signup, and a needs_follow_up flag
-- admins can set on an order_request.

-- ---------------------------------------------------------------------
-- Auto-create a profiles row whenever someone signs up via Supabase Auth.
-- Everyone starts as role='customer' — there is NO self-service path to
-- becoming an admin. Promote someone by running, as the project owner:
--   update profiles set role = 'admin' where id = '<their-auth-uid>';
-- ---------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'customer');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------
-- needs_follow_up: a coordinator's manual flag, separate from `status`.
-- An order can be perfectly "PENDING_ARTISAN_CONFIRMATION" and still need
-- a human to chase it up (e.g. no artisan reply after 24h) — this is a
-- work-queue marker, not a lifecycle state, so it doesn't belong in the
-- order_status enum.
-- ---------------------------------------------------------------------
alter table order_requests
  add column if not exists needs_follow_up boolean not null default false;

create index if not exists order_requests_follow_up_idx on order_requests (needs_follow_up);
