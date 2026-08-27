"use server";

import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/types";

const trackOrderSchema = z.object({
  orderReference: z.string().trim().min(4, "Enter your order reference, e.g. JL-2048"),
  phoneNumber: z.string().regex(/^\+254\d{9}$/, "Use a Kenyan number in the format +2547XXXXXXXX"),
});

export interface TrackedOrder {
  order_reference: string;
  status: OrderStatus;
  product_name: string;
  quantity: number;
  updated_at: string;
}

export type TrackOrderResult =
  | { success: true; order: TrackedOrder }
  | { success: false; error: string };

/**
 * Looks up an order by reference + phone number together — never by
 * reference alone. order_requests has no public SELECT policy for exactly
 * this reason (see track_order() in the SQL migration): a guessable
 * 4-digit reference should never leak someone else's name or instructions.
 */
export async function trackOrder(input: unknown): Promise<TrackOrderResult> {
  const parsed = trackOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("track_order", {
    p_reference: parsed.data.orderReference.toUpperCase(),
    p_phone: parsed.data.phoneNumber,
  });

  if (error) {
    console.error("track_order RPC error:", error);
    return { success: false, error: "Something went wrong looking up your order." };
  }

  const order = data?.[0];
  if (!order) {
    return {
      success: false,
      error: "No order found with that reference and phone number. Double check both.",
    };
  }

  return { success: true, order };
}
