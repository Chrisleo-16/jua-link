-- JuaLink schema — phase 3 SMS hardening
-- Adds webhook processing metadata and inbound idempotency guardrails.

alter table sms_messages
  add column if not exists provider_payload jsonb,
  add column if not exists processing_result text;

-- Prevent duplicate inbound processing when Africa's Talking retries the
-- same message id. (Outbound ids are provider-assigned and can be tracked
-- separately; this uniqueness is only for inbound.)
create unique index if not exists sms_messages_inbound_message_id_uidx
  on sms_messages (africa_talking_message_id)
  where direction = 'inbound' and africa_talking_message_id is not null;
