"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/guard";
import type { VerificationStatus } from "@/lib/types";

export interface AdminArtisanRow {
  id: string;
  full_name: string;
  business_name: string;
  phone_number: string;
  location: string;
  craft_category: string;
  verification_status: VerificationStatus;
  is_active: boolean;
  created_at: string;
}

export async function fetchArtisans(filters: {
  search?: string;
  status?: VerificationStatus | "ALL";
}): Promise<AdminArtisanRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("artisans")
    .select(
      "id, full_name, business_name, phone_number, location, craft_category, verification_status, is_active, created_at"
    )
    .order("created_at", { ascending: false });

  if (filters.status && filters.status !== "ALL") {
    query = query.eq("verification_status", filters.status);
  }
  if (filters.search) {
    query = query.or(
      `full_name.ilike.%${filters.search}%,business_name.ilike.%${filters.search}%,phone_number.ilike.%${filters.search}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error("fetchArtisans error:", error);
    return [];
  }
  return data;
}

export type UpdateArtisanResult = { success: true } | { success: false; error: string };

/**
 * Approving an artisan (setting VERIFIED) also flips is_active to true —
 * an artisan can't receive order-request SMS while inactive, so
 * verification and activation are tied together by default. Suspending
 * does the reverse. Admins can still flip is_active independently later
 * if that distinction turns out to matter.
 */
export async function updateArtisanVerification(
  artisanId: string,
  status: VerificationStatus
): Promise<UpdateArtisanResult> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Not authorized." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("artisans")
    .update({
      verification_status: status,
      is_active: status === "VERIFIED",
    })
    .eq("id", artisanId);

  if (error) {
    console.error("updateArtisanVerification error:", error);
    return { success: false, error: "Could not update this artisan." };
  }
  return { success: true };
}
