"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/guard";
import { sendSms } from "@/lib/africastalking/sms";
import { CUSTOMER_FACING_STATUSES, STATUS_LABELS, type OrderStatus } from "@/lib/types";

export interface AdminOrderRow {
  id: string;
  order_reference: string;
  status: OrderStatus;
  needs_follow_up: boolean;
  customer_name: string;
  customer_phone: string;
  quantity: number;
  created_at: string;
  updated_at: string;
  product: { name: string } | null;
  artisan: { business_name: string } | null;
}

export async function fetchOrders(filters: {
  status?: OrderStatus | "ALL";
  search?: string;
}): Promise<AdminOrderRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("order_requests")
    .select(
      "id, order_reference, status, needs_follow_up, customer_name, customer_phone, quantity, created_at, updated_at, product:products(name), artisan:artisans(business_name)"
    )
    .order("created_at", { ascending: false });

  if (filters.status && filters.status !== "ALL") {
    query = query.eq("status", filters.status);
  }
  if (filters.search) {
    query = query.or(
      `order_reference.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%,customer_phone.ilike.%${filters.search}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error("fetchOrders error:", error);
    return [];
  }
  return data as unknown as AdminOrderRow[];
}

export interface OrderDetail extends AdminOrderRow {
  customer_location: string;
  request_type: string;
  preferred_timeline: string | null;
  special_instructions: string | null;
  artisan_response: string | null;
}

export interface StatusEvent {
  id: string;
  old_status: OrderStatus | null;
  new_status: OrderStatus;
  note: string | null;
  created_at: string;
}

export interface SmsLogRow {
  id: string;
  direction: string;
  message_body: string;
  delivery_status: string | null;
  created_at: string;
}

export async function fetchOrderDetail(
  orderId: string
): Promise<{ order: OrderDetail; events: StatusEvent[]; sms: SmsLogRow[] } | null> {
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("order_requests")
    .select(
      "id, order_reference, status, needs_follow_up, customer_name, customer_phone, customer_location, quantity, request_type, preferred_timeline, special_instructions, artisan_response, created_at, updated_at, product:products(name), artisan:artisans(business_name)"
    )
    .eq("id", orderId)
    .single();

  if (!order) return null;

  const { data: events } = await supabase
    .from("order_status_events")
    .select("id, old_status, new_status, note, created_at")
    .eq("order_request_id", orderId)
    .order("created_at", { ascending: true });

  const { data: sms } = await supabase
    .from("sms_messages")
    .select("id, direction, message_body, delivery_status, created_at")
    .eq("order_request_id", orderId)
    .order("created_at", { ascending: true });

  return {
    order: order as unknown as OrderDetail,
    events: events ?? [],
    sms: sms ?? [],
  };
}

export type OrderActionResult = { success: true } | { success: false; error: string };

// Statuses the webhook never sets itself (ACCEPTED/DECLINED/CALLBACK_REQUESTED
// come from the SMS webhook already sending their own customer SMS) — these
// are the internal, admin-driven statuses where a manual customer update
// makes sense on transition.
const ADMIN_STATUS_NOTIFY: OrderStatus[] = ["READY", "COMPLETED", "CANCELLED"];

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  note?: string
): Promise<OrderActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Not authorized." };

  const supabase = await createClient();

  const { data: current } = await supabase
    .from("order_requests")
    .select("status, order_reference, customer_phone")
    .eq("id", orderId)
    .single();

  if (!current) return { success: false, error: "Order not found." };

  const { error: updateError } = await supabase
    .from("order_requests")
    .update({ status: newStatus })
    .eq("id", orderId);

  if (updateError) {
    console.error("updateOrderStatus error:", updateError);
    return { success: false, error: "Could not update order status." };
  }

  await supabase.from("order_status_events").insert({
    order_request_id: orderId,
    old_status: current.status,
    new_status: newStatus,
    note: note || `Status manually updated by ${admin.full_name}`,
    changed_by: admin.id,
  });

  // Only send a customer SMS for statuses that are both customer-facing AND
  // not already covered by the SMS webhook's own notifications.
  if (
    CUSTOMER_FACING_STATUSES.includes(newStatus) &&
    ADMIN_STATUS_NOTIFY.includes(newStatus)
  ) {
    await sendSms({
      to: current.customer_phone,
      message: `JuaLink: Update on request ${current.order_reference} — ${STATUS_LABELS[newStatus]}.`,
      orderRequestId: orderId,
    });
  }

  return { success: true };
}

export async function sendManualSms(orderId: string, message: string): Promise<OrderActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Not authorized." };
  if (!message.trim()) return { success: false, error: "Message cannot be empty." };

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("order_requests")
    .select("customer_phone")
    .eq("id", orderId)
    .single();

  if (!order) return { success: false, error: "Order not found." };

  await sendSms({ to: order.customer_phone, message, orderRequestId: orderId });
  return { success: true };
}

export async function toggleFollowUp(orderId: string, value: boolean): Promise<OrderActionResult> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Not authorized." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("order_requests")
    .update({ needs_follow_up: value })
    .eq("id", orderId);

  if (error) return { success: false, error: "Could not update follow-up flag." };
  return { success: true };
}
