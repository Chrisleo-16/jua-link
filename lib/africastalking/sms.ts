import { createServiceRoleClient } from "@/lib/supabase/server";

interface SendSmsParams {
  to: string; // E.164, e.g. +2547XXXXXXXX
  message: string;
  orderRequestId?: string;
  artisanId?: string;
}

const AT_USERNAME = process.env.AFRICASTALKING_USERNAME;
const AT_API_KEY = process.env.AFRICASTALKING_API_KEY;
const AT_SENDER_ID = process.env.AFRICASTALKING_SENDER_ID;

/** True when real credentials are configured. Falls back to a console-logged
 *  mock otherwise, so the whole order flow is demoable with zero setup. */
const isLiveMode = Boolean(AT_USERNAME && AT_API_KEY);

/**
 * Sends an SMS via Africa's Talking (or logs it in mock mode), and always
 * records the message in `sms_messages` so the admin comms log stays
 * complete regardless of whether delivery succeeded.
 */
export async function sendSms({ to, message, orderRequestId, artisanId }: SendSmsParams) {
  let africaTalkingMessageId: string | null = null;
  let deliveryStatus = "queued";

  if (isLiveMode) {
    try {
      const response = await fetch("https://api.africastalking.com/version1/messaging", {
        method: "POST",
        headers: {
          apiKey: AT_API_KEY!,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          username: AT_USERNAME!,
          to,
          message,
          ...(AT_SENDER_ID ? { from: AT_SENDER_ID } : {}),
        }),
      });

      const data = await response.json();
      const recipient = data?.SMSMessageData?.Recipients?.[0];

      if (recipient) {
        africaTalkingMessageId = recipient.messageId ?? null;
        deliveryStatus = recipient.status ?? "sent";
      } else {
        deliveryStatus = "failed";
      }
    } catch (error) {
      // Never throw out of sendSms — a failed SMS should not break the
      // order flow. Log it, mark it failed, and let the admin comms log
      // surface it for follow-up.
      console.error("Africa's Talking SMS send failed:", error);
      deliveryStatus = "failed";
    }
  } else {
    console.log(`[MOCK SMS] to=${to} message="${message}"`);
    deliveryStatus = "mock_sent";
  }

  const supabase = createServiceRoleClient();
  await supabase.from("sms_messages").insert({
    order_request_id: orderRequestId ?? null,
    artisan_id: artisanId ?? null,
    customer_phone: to,
    direction: "outbound",
    message_body: message,
    africa_talking_message_id: africaTalkingMessageId,
    delivery_status: deliveryStatus,
  });

  return { success: deliveryStatus !== "failed", deliveryStatus };
}
