"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/guard";
import type { ApprovalStatus } from "@/lib/types";

export interface AdminProductRow {
  id: string;
  name: string;
  slug: string;
  approval_status: ApprovalStatus;
  is_available: boolean;
  price_from: number | null;
  category: { name: string } | null;
  artisan: { business_name: string } | null;
  created_at: string;
}

export async function fetchAdminProducts(filters: {
  search?: string;
  approvalStatus?: ApprovalStatus | "ALL";
}): Promise<AdminProductRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select(
      "id, name, slug, approval_status, is_available, price_from, created_at, category:categories(name), artisan:artisans(business_name)"
    )
    .order("created_at", { ascending: false });

  if (filters.approvalStatus && filters.approvalStatus !== "ALL") {
    query = query.eq("approval_status", filters.approvalStatus);
  }
  if (filters.search) {
    query = query.ilike("name", `%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("fetchAdminProducts error:", error);
    return [];
  }
  return data as unknown as AdminProductRow[];
}

export async function fetchCategoriesForAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("id, name").order("name");
  return data ?? [];
}

export async function fetchVerifiedArtisansForAdmin() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("artisans")
    .select("id, business_name")
    .eq("verification_status", "VERIFIED")
    .order("business_name");
  return data ?? [];
}

const productSchema = z.object({
  name: z.string().min(2),
  categoryId: z.string().uuid(),
  artisanId: z.string().uuid(),
  shortDescription: z.string().min(2).max(200),
  description: z.string().min(2),
  material: z.string().optional(),
  priceFrom: z.coerce.number().nonnegative().optional(),
  priceTo: z.coerce.number().nonnegative().optional(),
  leadTimeDays: z.coerce.number().int().nonnegative().optional(),
  location: z.string().min(2),
  isCustomizable: z.boolean(),
  imageUrls: z.array(z.string().url()).default([]),
});

export type ProductFormResult = { success: true } | { success: false; error: string };

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") +
    "-" +
    Math.random().toString(36).slice(2, 6)
  );
}

export async function createProduct(input: unknown): Promise<ProductFormResult> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Not authorized." };

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const data = parsed.data;

  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from("products")
    .insert({
      name: data.name,
      slug: slugify(data.name),
      category_id: data.categoryId,
      artisan_id: data.artisanId,
      short_description: data.shortDescription,
      description: data.description,
      material: data.material || null,
      price_from: data.priceFrom ?? null,
      price_to: data.priceTo ?? null,
      lead_time_days: data.leadTimeDays ?? null,
      location: data.location,
      is_customizable: data.isCustomizable,
      approval_status: "approved", // admin-created products are pre-approved
    })
    .select("id")
    .single();

  if (error || !product) {
    console.error("createProduct error:", error);
    return { success: false, error: "Could not create this product." };
  }

  if (data.imageUrls.length > 0) {
    await supabase.from("product_images").insert(
      data.imageUrls.map((url, i) => ({
        product_id: product.id,
        image_url: url,
        sort_order: i,
      }))
    );
  }

  return { success: true };
}

export async function setProductApproval(
  productId: string,
  status: ApprovalStatus
): Promise<ProductFormResult> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Not authorized." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ approval_status: status })
    .eq("id", productId);

  if (error) return { success: false, error: "Could not update approval status." };
  return { success: true };
}

export async function deleteProduct(productId: string): Promise<ProductFormResult> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Not authorized." };

  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", productId);

  if (error) return { success: false, error: "Could not delete this product." };
  return { success: true };
}
