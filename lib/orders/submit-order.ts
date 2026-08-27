"use server";

import { z } from "zod";
import { createOrderRequest, type CreateOrderResult } from "@/lib/orders/create-order";

// Validation lives here, next to the action that uses it, so the web form
// and the server agree on exactly one set of rules. The USSD flow does its
// own lighter validation in lib/ussd/menu.ts (menu choices, not free text)
// and calls createOrderRequest() directly.
const orderRequestSchema = z.object({
  productId: z.string().uuid(),
  customerName: z.string().min(2, "Enter your full name"),
  customerPhone: z
    .string()
    .regex(/^\+254\d{9}$/, "Use a Kenyan number in the format +2547XXXXXXXX"),
  customerLocation: z.string().min(2, "Enter your location"),
  quantity: z.coerce.number().int().min(1).max(999),
  requestType: z.enum(["standard", "custom"]),
  preferredTimeline: z.string().optional(),
  specialInstructions: z.string().max(500).optional(),
  referenceImageUrl: z.string().url().optional(),
  consentToContact: z.literal(true, {
    errorMap: () => ({ message: "Consent is required so the artisan can reach you" }),
  }),
});

export type OrderRequestInput = z.infer<typeof orderRequestSchema>;
export type SubmitOrderResult = CreateOrderResult;

export async function submitOrderRequest(input: unknown): Promise<SubmitOrderResult> {
  const parsed = orderRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const data = parsed.data;

  return createOrderRequest({
    productId: data.productId,
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    customerLocation: data.customerLocation,
    quantity: data.quantity,
    requestType: data.requestType,
    preferredTimeline: data.preferredTimeline ?? null,
    specialInstructions: data.specialInstructions ?? null,
    referenceImageUrl: data.referenceImageUrl ?? null,
    consentToContact: data.consentToContact,
  });
}
