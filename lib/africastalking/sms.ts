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
const isSandboxMode = AT_USERNAME?.trim().toLowerCase() === "sandbox";
const AT_SMS_BASE_URL =
  isSandboxMode ? "https://api.sandbox.africastalking.com" : "https://api.africastalking.com";

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
  let providerPayload: unknown = null;
  let processingResult = "outbound_queued";

  if (isLiveMode) {
    try {
      const response = await fetch(`${AT_SMS_BASE_URL}/version1/messaging`, {
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
          // Sandbox rejects many sender IDs; allow provider default there.
          ...(!isSandboxMode && AT_SENDER_ID ? { from: AT_SENDER_ID } : {}),
        }),
      });

      const data = await response.json();
      providerPayload = data;

      if (!response.ok) {
        deliveryStatus = "failed";
        processingResult = "outbound_failed";
        console.error("Africa's Talking SMS send failed (HTTP error):", {
          status: response.status,
          body: data,
        });
      }

      const recipient = data?.SMSMessageData?.Recipients?.[0];

      if (response.ok && recipient) {
        africaTalkingMessageId = recipient.messageId ?? null;
        const recipientStatus = String(recipient.status ?? "sent");
        const recipientStatusCode = String(recipient.statusCode ?? "");
        deliveryStatus = recipientStatus;

        const looksRejected = /rejected|failed|invalid|insufficient|denied/i.test(
          `${recipientStatus} ${recipientStatusCode}`
        );

        if (looksRejected) {
          processingResult = "outbound_failed";
          console.error("Africa's Talking SMS rejected recipient:", {
            to,
            status: recipientStatus,
            statusCode: recipientStatusCode,
            messageId: africaTalkingMessageId,
            sandbox: isSandboxMode,
          });
        } else {
          processingResult = "outbound_sent";
        }
      } else if (response.ok) {
        deliveryStatus = "failed";
        processingResult = "outbound_failed";
        console.error("Africa's Talking SMS send failed (no recipient in response):", data);
      }
    } catch (error) {
      // Never throw out of sendSms — a failed SMS should not break the
      // order flow. Log it, mark it failed, and let the admin comms log
      // surface it for follow-up.
      console.error("Africa's Talking SMS send failed:", error);
      deliveryStatus = "failed";
      processingResult = "outbound_failed";
      providerPayload = { error: String(error) };
    }
  } else {
    console.log(`[MOCK SMS] to=${to} message="${message}"`);
    deliveryStatus = "mock_sent";
    processingResult = "outbound_mock";
    providerPayload = { mode: "mock" };
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
    processing_result: processingResult,
    provider_payload: providerPayload,
  });

  return {
    success: processingResult === "outbound_sent" || processingResult === "outbound_mock",
    deliveryStatus,
  };
}
