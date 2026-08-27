"use server";

import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";

const artisanApplicationSchema = z.object({
  fullName: z.string().min(2, "Enter your full name"),
  businessName: z.string().min(2, "Enter your business or workshop name"),
  phoneNumber: z.string().regex(/^\+254\d{9}$/, "Use a Kenyan number in the format +2547XXXXXXXX"),
  location: z.string().min(2, "Enter your location"),
  craftCategory: z.string().min(2, "Select or describe your craft category"),
  productsMade: z.string().min(2, "Describe what you make"),
  yearsExperience: z.coerce.number().int().min(0).max(80).optional(),
  description: z.string().min(10, "Tell buyers a bit about your work").max(1000),
  declarationAccepted: z.literal(true, {
    errorMap: () => ({ message: "Please confirm the declaration to continue" }),
  }),
});

export type ArtisanApplicationResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Every application lands as verification_status = 'PENDING' — there is no
 * code path that auto-approves an artisan. An admin reviews and flips this
 * to VERIFIED (or REJECTED) from /admin/artisans (phase 3).
 */
export async function submitArtisanApplication(input: unknown): Promise<ArtisanApplicationResult> {
  const parsed = artisanApplicationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const data = parsed.data;

  const supabase = createServiceRoleClient();

  const { error } = await supabase.from("artisans").insert({
    full_name: data.fullName,
    business_name: data.businessName,
    phone_number: data.phoneNumber,
    location: data.location,
    craft_category: data.craftCategory,
    years_experience: data.yearsExperience ?? null,
    // products_made has no dedicated column — folded into description so
    // nothing the applicant wrote is lost.
    description: `Products made: ${data.productsMade}\n\n${data.description}`,
    verification_status: "PENDING",
    is_active: false, // stays inactive until an admin verifies them
  });

  if (error) {
    console.error("Failed to insert artisan application:", error);
    return { success: false, error: "Something went wrong submitting your application." };
  }

  return { success: true };
}
