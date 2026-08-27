-- JuaLink schema — phase 2
-- Adds product_images, ussd_sessions, and two columns on artisans that the
-- /join-as-artisan form collects but phase-1 didn't have a home for.

-- ---------------------------------------------------------------------
-- artisans: extra application fields
-- ---------------------------------------------------------------------
alter table artisans
  add column if not exists products_made text,
  add column if not exists workshop_image_urls text[] not null default '{}';

-- ---------------------------------------------------------------------
-- product_images
-- ---------------------------------------------------------------------
create table product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order int not null default 0
);

create index product_images_product_idx on product_images (product_id);

alter table product_images enable row level security;

create policy "product_images_public_read" on product_images
  for select using (
    exists (
      select 1 from products p
      where p.id = product_images.product_id
        and (p.approval_status = 'approved' or is_admin())
    )
  );
create policy "product_images_admin_write" on product_images
  for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------
-- ussd_sessions
--
-- Africa's Talking USSD is stateless per HTTP request — it sends the full
-- accumulated `text` (each menu choice joined by '*') on every request, so
-- the actual navigation logic in lib/ussd/menu.ts derives the current step
-- by splitting that string, not by reading this table. This table exists
-- purely so the admin Communications page (phase 3) has something to show
-- for USSD activity, mirroring the sms_messages log.
-- ---------------------------------------------------------------------
create table ussd_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  phone_number text not null,
  service_code text not null,
  text_input text not null default '',
  current_step text not null default 'root',
  selected_category uuid references categories(id) on delete set null,
  selected_product uuid references products(id) on delete set null,
  quantity int,
  location text,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index ussd_sessions_session_id_idx on ussd_sessions (session_id);
create index ussd_sessions_phone_idx on ussd_sessions (phone_number);

create trigger ussd_sessions_set_updated_at
  before update on ussd_sessions
  for each row execute function set_updated_at();

alter table ussd_sessions enable row level security;

create policy "ussd_sessions_admin_only" on ussd_sessions
  for all using (is_admin()) with check (is_admin());
