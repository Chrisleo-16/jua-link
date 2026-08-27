-- JuaLink core schema — phase 1
-- Covers: profiles, artisans, categories, products, order_requests,
-- order_status_events, sms_messages. This is enough to run the full
-- "browse -> request -> SMS -> accept/decline -> tracker" loop.
-- product_images and ussd_sessions land in migration 0002.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type user_role as enum ('admin', 'artisan', 'customer');
create type verification_status as enum ('PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED');
create type approval_status as enum ('pending', 'approved', 'rejected', 'hidden');
create type request_type as enum ('standard', 'custom');
create type artisan_response as enum ('accepted', 'declined', 'callback_requested');
create type order_status as enum (
  'PENDING_ARTISAN_CONFIRMATION',
  'ACCEPTED',
  'DECLINED',
  'CALLBACK_REQUESTED',
  'QUOTATION_NEEDED',
  'DEPOSIT_DISCUSSION',
  'IN_PRODUCTION',
  'READY',
  'COMPLETED',
  'CANCELLED'
);
create type sms_direction as enum ('inbound', 'outbound');

-- ---------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------
-- profiles (extends auth.users)
-- ---------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone_number text,
  role user_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- artisans
-- ---------------------------------------------------------------------
create table artisans (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete set null,
  full_name text not null,
  business_name text not null,
  phone_number text not null,
  whatsapp_number text,
  location text not null,
  county text,
  craft_category text not null,
  description text not null default '',
  years_experience int,
  verification_status verification_status not null default 'PENDING',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index artisans_phone_idx on artisans (phone_number);
create index artisans_verification_idx on artisans (verification_status);

create trigger artisans_set_updated_at
  before update on artisans
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------
create table products (
  id uuid primary key default gen_random_uuid(),
  artisan_id uuid not null references artisans(id) on delete cascade,
  category_id uuid not null references categories(id) on delete restrict,
  name text not null,
  slug text not null unique,
  short_description text not null default '',
  description text not null default '',
  material text,
  price_from numeric(12, 2),
  price_to numeric(12, 2),
  lead_time_days int,
  location text not null,
  is_customizable boolean not null default false,
  is_available boolean not null default true,
  approval_status approval_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_range_valid check (
    price_from is null or price_to is null or price_from <= price_to
  )
);

create index products_category_idx on products (category_id);
create index products_artisan_idx on products (artisan_id);
create index products_approval_idx on products (approval_status);

create trigger products_set_updated_at
  before update on products
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- order_requests
-- ---------------------------------------------------------------------
create table order_requests (
  id uuid primary key default gen_random_uuid(),
  order_reference text not null unique,
  product_id uuid not null references products(id) on delete restrict,
  artisan_id uuid not null references artisans(id) on delete restrict,
  customer_name text not null,
  customer_phone text not null,
  customer_location text not null,
  quantity int not null default 1 check (quantity > 0),
  request_type request_type not null default 'standard',
  preferred_timeline text,
  special_instructions text,
  reference_image_url text,
  consent_to_contact boolean not null default false,
  status order_status not null default 'PENDING_ARTISAN_CONFIRMATION',
  artisan_response artisan_response,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index order_requests_artisan_idx on order_requests (artisan_id);
create index order_requests_status_idx on order_requests (status);
create index order_requests_customer_phone_idx on order_requests (customer_phone);

create trigger order_requests_set_updated_at
  before update on order_requests
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- order_status_events (audit trail — every status change is logged)
-- ---------------------------------------------------------------------
create table order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_request_id uuid not null references order_requests(id) on delete cascade,
  old_status order_status,
  new_status order_status not null,
  note text,
  changed_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index order_status_events_order_idx on order_status_events (order_request_id);

-- ---------------------------------------------------------------------
-- sms_messages (every inbound/outbound SMS, for the admin comms log)
-- ---------------------------------------------------------------------
create table sms_messages (
  id uuid primary key default gen_random_uuid(),
  order_request_id uuid references order_requests(id) on delete set null,
  artisan_id uuid references artisans(id) on delete set null,
  customer_phone text not null,
  direction sms_direction not null,
  message_body text not null,
  africa_talking_message_id text,
  delivery_status text,
  created_at timestamptz not null default now()
);

create index sms_messages_order_idx on sms_messages (order_request_id);
create index sms_messages_phone_idx on sms_messages (customer_phone);

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table profiles enable row level security;
alter table artisans enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table order_requests enable row level security;
alter table order_status_events enable row level security;
alter table sms_messages enable row level security;

-- Helper: is the current user an admin?
create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer;

-- profiles: a user can read/update their own row; admins can read all
create policy "profiles_select_own_or_admin" on profiles
  for select using (auth.uid() = id or is_admin());
create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

-- categories & products: publicly readable when approved/active,
-- writable only by admins. (Customer order submission goes through a
-- server action using the service role, not direct client inserts —
-- see lib/africastalking + app/products/[slug]/actions.ts.)
create policy "categories_public_read" on categories
  for select using (is_active = true or is_admin());
create policy "categories_admin_write" on categories
  for all using (is_admin()) with check (is_admin());

create policy "products_public_read" on products
  for select using (approval_status = 'approved' or is_admin());
create policy "products_admin_write" on products
  for all using (is_admin()) with check (is_admin());

-- artisans: public can read verified/active artisan profiles (for the
-- "workshop summary" on a product page); artisans can read/update their
-- own row if they've created a login; admins can do everything.
create policy "artisans_public_read_verified" on artisans
  for select using (verification_status = 'VERIFIED' or is_admin());
create policy "artisans_self_read_update" on artisans
  for select using (profile_id = auth.uid());
create policy "artisans_self_update" on artisans
  for update using (profile_id = auth.uid());
create policy "artisans_admin_write" on artisans
  for all using (is_admin()) with check (is_admin());

-- order_requests: no direct public read/write. Customers submit through
-- a server action (service role) and track via order_reference + phone
-- (a dedicated RPC, not a raw table read). Artisans with an optional
-- login can see only their own requests. Admins see everything.
create policy "order_requests_artisan_own" on order_requests
  for select using (
    artisan_id in (select id from artisans where profile_id = auth.uid())
  );
create policy "order_requests_admin_all" on order_requests
  for all using (is_admin()) with check (is_admin());

-- order_status_events / sms_messages: admin + relevant artisan only.
create policy "order_status_events_admin" on order_status_events
  for all using (is_admin()) with check (is_admin());
create policy "order_status_events_artisan_read" on order_status_events
  for select using (
    order_request_id in (
      select id from order_requests where artisan_id in (
        select id from artisans where profile_id = auth.uid()
      )
    )
  );

create policy "sms_messages_admin" on sms_messages
  for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------
-- track_order RPC
--
-- Customers have no direct SELECT policy on order_requests (we don't
-- want an order reference alone, e.g. guessed sequentially, to expose
-- someone else's name/phone/instructions). Instead the /track-order
-- page calls this RPC, which only returns a row when BOTH the order
-- reference AND the phone number match — same trust model as most
-- delivery-tracking sites.
-- ---------------------------------------------------------------------
create or replace function track_order(p_reference text, p_phone text)
returns table (
  order_reference text,
  status order_status,
  product_name text,
  quantity int,
  updated_at timestamptz
) as $$
  select
    o.order_reference,
    o.status,
    p.name as product_name,
    o.quantity,
    o.updated_at
  from order_requests o
  join products p on p.id = o.product_id
  where o.order_reference = p_reference
    and o.customer_phone = p_phone;
$$ language sql stable security definer;
