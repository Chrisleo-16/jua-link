import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { parseArtisanReply, statusFromArtisanResponse } from "@/lib/types";
import { sendSms } from "@/lib/africastalking/sms";
import {
  customerAcceptedSms,
  customerDeclinedSms,
  customerCallbackSms,
} from "@/lib/africastalking/templates";

/**
 * Africa's Talking posts inbound SMS as application/x-www-form-urlencoded
 * with fields: from, to, text, date, id, linkId.
 * https://developers.africastalking.com/docs/sms/inbound
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const from = form.get("from")?.toString(); // artisan's phone number
  const text = form.get("text")?.toString();
  const messageId = form.get("id")?.toString() ?? null;

  if (!from || !text) {
    // Malformed payload — acknowledge with 200 anyway so Africa's Talking
    // doesn't keep retrying a request we can never process.
    return NextResponse.json({ status: "ignored", reason: "missing from/text" });
  }

  const supabase = createServiceRoleClient();

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
    });
    return NextResponse.json({ status: "ignored", reason: "unknown sender" });
  }

  // Step 2: find that artisan's most recent request still awaiting a reply.
  // (An artisan may have several open requests — we resolve the OLDEST
  // pending one first, first-in-first-out, rather than the newest, so
  // requests can't get starved by a flurry of later ones.)
  const { data: pendingOrder } = await supabase
    .from("order_requests")
    .select("id, order_reference, status, customer_phone")
    .eq("artisan_id", artisan.id)
    .eq("status", "PENDING_ARTISAN_CONFIRMATION")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (!pendingOrder) {
    await supabase.from("sms_messages").insert({
      artisan_id: artisan.id,
      customer_phone: from,
      direction: "inbound",
      message_body: text,
      africa_talking_message_id: messageId,
      delivery_status: "no_pending_order",
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
  });

  // Step 4: parse the reply.
  const response = parseArtisanReply(text);

  if (!response) {
    // Couldn't understand the reply. Leave the order PENDING and let a
    // coordinator follow up manually rather than silently dropping it.
    return NextResponse.json({ status: "unrecognized_reply" });
  }

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
    note: `Artisan replied via SMS: "${text}"`,
  });

  // Step 6: notify the customer with the matching template.
  const customerMessage =
    response === "accepted"
      ? customerAcceptedSms(pendingOrder.order_reference, artisan.business_name)
      : response === "declined"
      ? customerDeclinedSms(pendingOrder.order_reference)
      : customerCallbackSms(pendingOrder.order_reference);

  await sendSms({
    to: pendingOrder.customer_phone,
    message: customerMessage,
    orderRequestId: pendingOrder.id,
  });

  return NextResponse.json({ status: "processed", newStatus });
}
