import { sendGatewaySms } from "@/lib/africastalking/sms";
import type { OrderStatus } from "@/lib/types";
import {
  customerAcceptedSms,
  customerCallbackSms,
  customerCancelledSms,
  customerCompletedSms,
  customerDeclinedSms,
  customerReadySms,
} from "@/lib/africastalking/templates";

interface NotifyCustomerStatusParams {
  orderRequestId: string;
  orderReference: string;
  customerPhone: string;
  status: OrderStatus;
  workshopName?: string | null;
}

/**
 * Sends customer-facing status updates for statuses worth notifying by SMS.
 * Non-customer-facing statuses return skipped=true and perform no send.
 */
export async function notifyCustomerOnStatusChange(params: NotifyCustomerStatusParams) {
  const { orderRequestId, orderReference, customerPhone, status, workshopName } = params;

  const message =
    status === "ACCEPTED"
      ? customerAcceptedSms(orderReference, workshopName ?? "the artisan")
      : status === "DECLINED"
      ? customerDeclinedSms(orderReference)
      : status === "CALLBACK_REQUESTED"
      ? customerCallbackSms(orderReference)
      : status === "READY"
      ? customerReadySms(orderReference, workshopName ?? "the artisan")
      : status === "COMPLETED"
      ? customerCompletedSms(orderReference)
      : status === "CANCELLED"
      ? customerCancelledSms(orderReference)
      : null;

  if (!message) {
    return { skipped: true as const };
  }

  const result = await sendGatewaySms({
    to: customerPhone,
    body: message,
    orderRequestId,
  });

  return {
    skipped: false as const,
    ...result,
  };
}
