import { createServiceRoleClient } from "@/lib/supabase/server";
import { generateOrderReference, RequestType } from "@/lib/types";
import { sendSms } from "@/lib/africastalking/sms";
import { artisanRequestSms, customerSubmittedSms } from "@/lib/africastalking/templates";

export interface OrderCreateInput {
  productId: string;
  customerName: string;
  customerPhone: string; // E.164
  customerLocation: string;
  quantity: number;
  requestType: RequestType;
  preferredTimeline?: string | null;
  specialInstructions?: string | null;
  referenceImageUrl?: string | null;
  consentToContact: boolean;
}

export type CreateOrderResult =
  | { success: true; orderReference: string }
  | { success: false; error: string };

/**
 * Core order-creation logic, with no framework/validation concerns attached.
 * Callers are responsible for validating their own input shape first:
 *  - the web form validates with Zod in lib/orders/submit-order.ts
 *  - the USSD flow validates with simpler manual checks in lib/ussd/menu.ts
 *    (USSD input is numeric menu choices, not free-form text, so full Zod
 *    validation adds little there)
 */
export async function createOrderRequest(input: OrderCreateInput): Promise<CreateOrderResult> {
  const supabase = createServiceRoleClient();

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, name, artisan_id, approval_status")
    .eq("id", input.productId)
    .single();

  if (productError || !product) {
    return { success: false, error: "This product could not be found." };
  }
  if (product.approval_status !== "approved") {
    return { success: false, error: "This product is not currently available." };
  }

  const { data: artisan } = await supabase
    .from("artisans")
    .select("id, phone_number, is_active")
    .eq("id", product.artisan_id)
    .single();

  if (!artisan || !artisan.is_active) {
    return { success: false, error: "This artisan is not currently accepting requests." };
  }

  const orderReference = generateOrderReference();

  const { error: insertError } = await supabase.from("order_requests").insert({
    order_reference: orderReference,
    product_id: product.id,
    artisan_id: artisan.id,
    customer_name: input.customerName,
    customer_phone: input.customerPhone,
    customer_location: input.customerLocation,
    quantity: input.quantity,
    request_type: input.requestType,
    preferred_timeline: input.preferredTimeline ?? null,
    special_instructions: input.specialInstructions ?? null,
    reference_image_url: input.referenceImageUrl ?? null,
    consent_to_contact: input.consentToContact,
    status: "PENDING_ARTISAN_CONFIRMATION",
  });

  if (insertError) {
    console.error("Failed to insert order_request:", insertError);
    return { success: false, error: "Something went wrong saving your request. Try again." };
  }

  await sendSms({
    to: artisan.phone_number,
    message: artisanRequestSms({
      orderReference,
      productName: product.name,
      quantity: input.quantity,
      location: input.customerLocation,
      timeline: input.preferredTimeline ?? null,
    }),
    artisanId: artisan.id,
  });

  await sendSms({
    to: input.customerPhone,
    message: customerSubmittedSms(orderReference),
  });

  return { success: true, orderReference };
}
