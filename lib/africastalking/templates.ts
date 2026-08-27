// All customer/artisan-facing copy lives here, not scattered inline in the
// webhook or server actions — makes it trivial to review wording (and add
// Kiswahili variants later) without touching logic.

export function artisanRequestSms(params: {
  orderReference: string;
  productName: string;
  quantity: number;
  location: string;
  timeline: string | null;
}) {
  const { orderReference, productName, quantity, location, timeline } = params;
  const timelinePart = timeline ? ` Buyer needs it ${timeline}.` : "";
  return (
    `JuaLink: New request ${orderReference}. Product: ${quantity} ${productName}. ` +
    `Location: ${location}.${timelinePart} Reply '${orderReference} 1' to ACCEPT, '${orderReference} 2' to DECLINE, '${orderReference} 3' for CALLBACK.`
  );
}

export function customerAcceptedSms(orderReference: string, workshopName: string) {
  return (
    `JuaLink: Your request ${orderReference} has been accepted by ${workshopName}. ` +
    `The artisan will contact you to confirm final measurements, price, delivery, and deposit.`
  );
}

export function customerDeclinedSms(orderReference: string) {
  return (
    `JuaLink: The artisan is unavailable for request ${orderReference}. ` +
    `We are checking for another suitable maker.`
  );
}

export function customerCallbackSms(orderReference: string) {
  return (
    `JuaLink: The artisan requested a callback regarding request ${orderReference}. ` +
    `A JuaLink coordinator will contact you shortly.`
  );
}

export function customerSubmittedSms(orderReference: string) {
  return (
    `JuaLink: Request ${orderReference} submitted. We've notified the artisan — ` +
    `you'll get an SMS as soon as they respond.`
  );
}

export function customerReadySms(orderReference: string, workshopName: string) {
  return `JuaLink: Request ${orderReference} is ready from ${workshopName}. Please coordinate collection/delivery with the artisan.`;
}

export function customerCompletedSms(orderReference: string) {
  return `JuaLink: Request ${orderReference} is marked completed. Thank you for supporting local artisans.`;
}

export function customerCancelledSms(orderReference: string) {
  return `JuaLink: Request ${orderReference} has been cancelled. Contact support if this was unexpected.`;
}

export function artisanPendingReminderSms(orderReference: string) {
  return (
    `JuaLink reminder: request ${orderReference} is awaiting your response. ` +
    `Reply '${orderReference} 1' to ACCEPT, '${orderReference} 2' to DECLINE, or '${orderReference} 3' for CALLBACK.`
  );
}
