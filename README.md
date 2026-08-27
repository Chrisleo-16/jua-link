# JuaLink — starting scaffold

This is phase 1: just enough working code to run and reason about the
**core order loop** end to end. Not every page/table from the full concept
is here yet — see "What's not built yet" at the bottom.

## What's actually wired up right now

```
Customer submits order (lib/orders/submit-order.ts)
        │
        ▼
order_requests row created, status = PENDING_ARTISAN_CONFIRMATION
        │
        ▼
sendSms() → artisan gets: "New request JL-XXXX... Reply 1/2/3"
sendSms() → customer gets: "Request submitted..."
        │
        ▼
Artisan replies by SMS (real phone, or curl in mock mode)
        │
        ▼
POST /api/webhooks/africastalking/sms  (app/api/webhooks/africastalking/sms/route.ts)
  1. find artisan by phone number
  2. find their OLDEST order still PENDING_ARTISAN_CONFIRMATION
  3. log the inbound message regardless of whether we understood it
  4. parseArtisanReply() → 'accepted' | 'declined' | 'callback_requested' | null
  5. update order_requests.status + write an order_status_events row
  6. sendSms() the matching template back to the customer
```

Everything that decides *what a status means* lives in `lib/types.ts` —
`ORDER_STATUSES`, `parseArtisanReply()`, `statusFromArtisanResponse()`. The
webhook, the (future) USSD handler, and the admin dashboard should all
import from there rather than re-deciding what "2" means.

## Why an artisan is matched by "oldest pending order," not "most recent"

An artisan can have more than one open request at a time. If we matched
their reply to the *newest* pending order, a flood of new requests could
bump an older one out of reach of a reply that was actually meant for it.
FIFO is simpler to explain to a coordinator debugging a mismatch, too.

## Running it

```bash
npm install
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY from your Supabase project settings

# apply the schema
supabase db push   # or paste supabase/migrations/0001_core_schema.sql
                    # into the Supabase SQL editor

npm run dev
```

Leave the `AFRICASTALKING_*` variables blank to run in **mock SMS mode** —
`sendSms()` logs the message to the console and still writes it to
`sms_messages`, so you can test the whole loop without an Africa's
Talking account.

## Testing the loop manually

1. Insert a category, an artisan (with your real test phone number in
   `phone_number`), and one approved product directly in the Supabase
   table editor (there's no admin UI yet — see below).
2. Call `submitOrderRequest()` from a temporary test page, or `curl` a
   route handler that wraps it, with that product's id.
3. In mock mode: check your terminal for the two `[MOCK SMS]` lines and
   confirm rows appeared in `order_requests` and `sms_messages`.
4. Simulate the artisan's reply by POSTing to the webhook the same way
   Africa's Talking would:

   ```bash
   curl -X POST http://localhost:3000/api/webhooks/africastalking/sms \
     -d "from=+2547XXXXXXXX" -d "text=1" -d "id=test-msg-1"
   ```

   (`from` must match the artisan's `phone_number` exactly.)
5. Check `order_requests.status` is now `ACCEPTED`, `order_status_events`
   has a new row, and a customer-facing "accepted" SMS was logged.

## SMS integration contract (backend handoff)

### Outbound: use one function only

- Call `sendSms()` in `lib/africastalking/sms.ts` for all outbound sends.
- Pass `orderRequestId` and `artisanId` whenever known so admin logs remain linked.
- Do not call Africa's Talking APIs directly from feature code.

### Message copy: templates only

- Keep SMS wording in `lib/africastalking/templates.ts`.
- For status-based customer updates, call `notifyCustomerOnStatusChange()` in
  `lib/orders/status-sms.ts` instead of building inline message strings.

### Inbound webhook behavior

`POST /api/webhooks/africastalking/sms` now does:

1. Optional webhook auth check via `AFRICASTALKING_SMS_WEBHOOK_SECRET`
  (query `?token=` or header `x-at-webhook-token`).
2. Idempotency check by inbound `id` (`africa_talking_message_id`) to avoid
  double-processing provider retries.
3. Artisan lookup by `from` phone number.
4. Reply parsing via `parseArtisanReplyInput()` in `lib/types.ts`, supporting:
  - `1`, `2`, `3`
  - `ACCEPT`, `DECLINE`, `CALLBACK`
  - explicit references like `JL-2048 1`
5. Order match strategy:
  - if reference is present: match that exact pending order for that artisan
  - if not: fallback to oldest pending order (FIFO)
6. Status update + status event + customer SMS notifier.

### Artisan signup via SMS (new)

- An unknown sender can start artisan onboarding by texting `JOIN` (also accepts
  `APPLY` or `ARTISAN`) to your Africa's Talking number.
- The webhook runs a step-by-step flow and stores progress in
  `sms_artisan_onboarding_sessions`.
- Prompts collect: full name, business name, location, craft category,
  products made, years experience (or `SKIP`), description, and final
  `YES` confirmation.
- On `YES`, a new `artisans` row is created with:
  - `verification_status = 'PENDING'`
  - `is_active = false`
- User can send `CANCEL` at any step to stop onboarding.
- If a phone number is already registered as an artisan, webhook returns
  `artisan_already_registered` and does not create duplicates.

### Callback URL to configure in Africa's Talking

Set the SMS callback URL to:

- Production:
  - `https://YOUR_DOMAIN/api/webhooks/africastalking/sms?token=YOUR_SECRET`
- Local (through a public tunnel during testing):
  - `https://YOUR_TUNNEL_DOMAIN/api/webhooks/africastalking/sms?token=YOUR_SECRET`

Also set the same secret in `.env.local`:

```bash
AFRICASTALKING_SMS_WEBHOOK_SECRET=YOUR_SECRET
```

If you prefer headers over query strings, Africa's Talking must send
`x-at-webhook-token` with the same value.

### New SMS telemetry fields

Migration `supabase/migrations/0003_sms_hardening.sql` adds:

- `sms_messages.provider_payload` (`jsonb`) for raw provider payload/response
- `sms_messages.processing_result` (`text`) for processing outcomes
- inbound unique index on `africa_talking_message_id` for idempotency

## Phase 2 additions (customer pages + USSD)

- `/products` — filterable catalogue (`lib/products/queries.ts`)
- `/products/[slug]` — gallery, artisan summary, and the request form
- `/track-order` — reference + phone lookup via the `track_order` RPC
- `/join-as-artisan` — application form, always lands as `PENDING`
- `POST /api/webhooks/africastalking/ussd` — full browse/request/track flow

`lib/orders/create-order.ts` now holds the actual order-creation logic
(product/artisan lookup, insert, both SMS sends). Both the web form
(`lib/orders/submit-order.ts`, Zod-validated) and the USSD flow call into
it, so there's exactly one place that decides what "creating an order"
means.

### How the USSD flow keeps state without a server-side session

Africa's Talking sends the **full accumulated `text`** on every request —
e.g. `"2*1*3*4*Kasarani"` for someone who chose "Request a product" →
category 1 → product 3 → quantity 4 → typed "Kasarani". There's no session
to read from between requests, so `app/api/webhooks/africastalking/ussd/route.ts`
just re-derives where the user is by splitting that string on `*` — the
array's *length* tells us the step, its *values* tell us what was picked.

The one thing this requires: any list we show (categories, products) has to
come back in the exact same order every time, since the user's next input
is just "the number they saw," not a stable ID. `lib/ussd/menu.ts` always
orders by `name` for this reason — don't change that ordering without also
handling in-flight sessions.

The `ussd_sessions` table is a **best-effort audit log only** (for the
future admin Communications page) — it is never read to drive navigation,
only written to.

### Testing the USSD flow locally

```bash
# Root menu
curl -X POST http://localhost:3000/api/webhooks/africastalking/ussd \
  -d "sessionId=test1" -d "phoneNumber=+2547XXXXXXXX" -d "serviceCode=*384*1#" -d "text="

# Chose "2" (Request a product)
curl -X POST http://localhost:3000/api/webhooks/africastalking/ussd \
  -d "sessionId=test1" -d "phoneNumber=+2547XXXXXXXX" -d "serviceCode=*384*1#" -d "text=2"

# ...then category "1", product "1", quantity "2", location "Kasarani":
curl -X POST .../ussd -d "sessionId=test1" -d "phoneNumber=+2547XXXXXXXX" -d "text=2*1"
curl -X POST .../ussd -d "sessionId=test1" -d "phoneNumber=+2547XXXXXXXX" -d "text=2*1*1"
curl -X POST .../ussd -d "sessionId=test1" -d "phoneNumber=+2547XXXXXXXX" -d "text=2*1*1*2"
curl -X POST .../ussd -d "sessionId=test1" -d "phoneNumber=+2547XXXXXXXX" -d "text=2*1*1*2*Kasarani"
```

The last call should create an `order_requests` row and return an `END`
response with the order reference.

## What's still not built (next phase — say when you want it)

- Admin dashboard (`/admin/*`) — artisan verification, product/order
  management, SMS/USSD logs
- Supabase Storage upload flow for product/reference images (forms
  currently accept an image URL, not a file upload)
- Seed data script for categories/products/artisans

## Design system note

Using Tailwind + shadcn/ui-style components (`components/ui/`) as the base,
with AlignUI's token conventions folded into `tailwind.config.ts` so the two
can share components without visual drift. HeroUI (`@heroui/react`) is
installed but not wired into a provider yet — bring it in deliberately for
one component at a time rather than wrapping the whole app in
`HeroUIProvider`, to avoid two competing Tailwind theme layers.
