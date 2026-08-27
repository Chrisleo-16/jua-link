import { createClient } from "@/lib/supabase/server";

export interface AdminStats {
  totalArtisans: number;
  verifiedArtisans: number;
  pendingArtisans: number;
  totalProducts: number;
  pendingProducts: number;
  pendingOrders: number;
  acceptedOrders: number;
  ordersNeedingFollowUp: number;
  recentSms: {
    id: string;
    direction: string;
    customer_phone: string;
    message_body: string;
    created_at: string;
  }[];
}

/**
 * Every count below relies on RLS letting an authenticated admin read the
 * whole table (see the "*_admin_all" / "is_admin()" policies in the
 * migrations) — this uses the session-aware client, not the service role,
 * so it only works when actually logged in as an admin.
 */
export async function fetchAdminStats(): Promise<AdminStats> {
  const supabase = await createClient();

  const [
    { count: totalArtisans },
    { count: verifiedArtisans },
    { count: pendingArtisans },
    { count: totalProducts },
    { count: pendingProducts },
    { count: pendingOrders },
    { count: acceptedOrders },
    { count: ordersNeedingFollowUp },
    { data: recentSms },
  ] = await Promise.all([
    supabase.from("artisans").select("*", { count: "exact", head: true }),
    supabase
      .from("artisans")
      .select("*", { count: "exact", head: true })
      .eq("verification_status", "VERIFIED"),
    supabase
      .from("artisans")
      .select("*", { count: "exact", head: true })
      .eq("verification_status", "PENDING"),
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("approval_status", "pending"),
    supabase
      .from("order_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "PENDING_ARTISAN_CONFIRMATION"),
    supabase
      .from("order_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "ACCEPTED"),
    supabase
      .from("order_requests")
      .select("*", { count: "exact", head: true })
      .eq("needs_follow_up", true),
    supabase
      .from("sms_messages")
      .select("id, direction, customer_phone, message_body, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  return {
    totalArtisans: totalArtisans ?? 0,
    verifiedArtisans: verifiedArtisans ?? 0,
    pendingArtisans: pendingArtisans ?? 0,
    totalProducts: totalProducts ?? 0,
    pendingProducts: pendingProducts ?? 0,
    pendingOrders: pendingOrders ?? 0,
    acceptedOrders: acceptedOrders ?? 0,
    ordersNeedingFollowUp: ordersNeedingFollowUp ?? 0,
    recentSms: recentSms ?? [],
  };
}
