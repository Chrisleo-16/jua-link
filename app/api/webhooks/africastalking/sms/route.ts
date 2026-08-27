import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { parseArtisanReplyInput, statusFromArtisanResponse } from "@/lib/types";
import { notifyCustomerOnStatusChange } from "@/lib/orders/status-sms";

const SMS_WEBHOOK_SECRET = process.env.AFRICASTALKING_SMS_WEBHOOK_SECRET;

function hasValidWebhookSecret(req: NextRequest): boolean {
  if (!SMS_WEBHOOK_SECRET) return true;
  const querySecret = req.nextUrl.searchParams.get("token");
  const headerSecret = req.headers.get("x-at-webhook-token");
  return querySecret === SMS_WEBHOOK_SECRET || headerSecret === SMS_WEBHOOK_SECRET;
}

/**
 * Africa's Talking posts inbound SMS as application/x-www-form-urlencoded
 * with fields: from, to, text, date, id, linkId.
 * https://developers.africastalking.com/docs/sms/inbound
 */
export async function POST(req: NextRequest) {
  if (!hasValidWebhookSecret(req)) {
    return NextResponse.json({ status: "ignored", reason: "unauthorized" });
  }

  const form = await req.formData();
  const payload = Object.fromEntries(form.entries());
  const from = form.get("from")?.toString(); // artisan's phone number
  const text = form.get("text")?.toString();
  const messageId = form.get("id")?.toString() ?? null;

  if (!from || !text) {
    // Malformed payload — acknowledge with 200 anyway so Africa's Talking
    // doesn't keep retrying a request we can never process.
    return NextResponse.json({ status: "ignored", reason: "missing from/text" });
  }

  const supabase = createServiceRoleClient();

  if (messageId) {
    const { data: existing } = await supabase
      .from("sms_messages")
      .select("id")
      .eq("direction", "inbound")
      .eq("africa_talking_message_id", messageId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ status: "ignored", reason: "duplicate_message" });
    }
  }

  // Step 1: identify the artisan by phone number.
  const { data: artisan } = await supabase
    .from("artisans")
    .select("id, business_name, phone_number")
    .eq("phone_number", from)
    .single();

  if (!artisan) {
    // Unknown sender — log it for a coordinator to review, don't guess.
    await supabase.from("sms_messages").insert({
      customer_phone: from,
      direction: "inbound",
      message_body: text,
      africa_talking_message_id: messageId,
      delivery_status: "unmatched_sender",
      processing_result: "unmatched_sender",
      provider_payload: payload,
    });
    return NextResponse.json({ status: "ignored", reason: "unknown sender" });
  }

  const parsedReply = parseArtisanReplyInput(text);
  if (!parsedReply) {
    await supabase.from("sms_messages").insert({
      artisan_id: artisan.id,
      customer_phone: from,
      direction: "inbound",
      message_body: text,
      africa_talking_message_id: messageId,
      delivery_status: "received",
      processing_result: "parse_failed",
      provider_payload: payload,
    });
    return NextResponse.json({ status: "unrecognized_reply" });
  }

  let pendingOrder: {
    id: string;
    order_reference: string;
    status: string;
    customer_phone: string;
  } | null = null;

  if (parsedReply.orderReference) {
    const { data: referencedOrder } = await supabase
      .from("order_requests")
      .select("id, order_reference, status, customer_phone")
      .eq("artisan_id", artisan.id)
      .eq("status", "PENDING_ARTISAN_CONFIRMATION")
      .eq("order_reference", parsedReply.orderReference)
      .maybeSingle();

    pendingOrder = referencedOrder;

    if (!pendingOrder) {
      await supabase.from("sms_messages").insert({
        artisan_id: artisan.id,
        customer_phone: from,
        direction: "inbound",
        message_body: text,
        africa_talking_message_id: messageId,
        delivery_status: "unknown_reference",
        processing_result: "unknown_reference",
        provider_payload: payload,
      });
      return NextResponse.json({ status: "ignored", reason: "unknown_reference" });
    }
  }

  if (!pendingOrder) {
    // No explicit order reference in the SMS; use FIFO fallback.
    const { data: oldestPendingOrder } = await supabase
      .from("order_requests")
      .select("id, order_reference, status, customer_phone")
      .eq("artisan_id", artisan.id)
      .eq("status", "PENDING_ARTISAN_CONFIRMATION")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    pendingOrder = oldestPendingOrder;
  }

  if (!pendingOrder) {
    await supabase.from("sms_messages").insert({
      artisan_id: artisan.id,
      customer_phone: from,
      direction: "inbound",
      message_body: text,
      africa_talking_message_id: messageId,
      delivery_status: "no_pending_order",
      processing_result: "no_pending_order",
      provider_payload: payload,
    });
    return NextResponse.json({ status: "ignored", reason: "no pending order for artisan" });
  }

  // Step 3: log the inbound message against that order regardless of
  // whether we can parse it — the admin comms log should show everything.
  await supabase.from("sms_messages").insert({
    order_request_id: pendingOrder.id,
    artisan_id: artisan.id,
    customer_phone: from,
    direction: "inbound",
    message_body: text,
    africa_talking_message_id: messageId,
    delivery_status: "received",
    processing_result: "received",
    provider_payload: payload,
  });

  const response = parsedReply.response;

  const newStatus = statusFromArtisanResponse(response);

  // Step 5: update the order and write the audit trail in one transaction-
  // like sequence (Supabase JS doesn't expose multi-table transactions
  // directly, so we do the update first, then the event log; a failure of
  // the second step is non-critical and left for the admin log to reveal).
  await supabase
    .from("order_requests")
    .update({ status: newStatus, artisan_response: response })
    .eq("id", pendingOrder.id);

  await supabase.from("order_status_events").insert({
    order_request_id: pendingOrder.id,
    old_status: pendingOrder.status,
    new_status: newStatus,
    note: parsedReply.orderReference
      ? `Artisan replied via SMS: "${text}" (reference=${parsedReply.orderReference})`
      : `Artisan replied via SMS: "${text}"`,
  });

  await notifyCustomerOnStatusChange({
    orderRequestId: pendingOrder.id,
    orderReference: pendingOrder.order_reference,
    customerPhone: pendingOrder.customer_phone,
    status: newStatus,
    workshopName: artisan.business_name,
  });

  return NextResponse.json({ status: "processed", newStatus });
}
