import { createClient } from "@/lib/supabase/server";

export interface ProductFilters {
  search?: string;
  categorySlug?: string;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  customOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  short_description: string;
  price_from: number | null;
  price_to: number | null;
  location: string;
  is_customizable: boolean;
  lead_time_days: number | null;
  category: { name: string; slug: string } | null;
  primary_image_url: string | null;
}

/**
 * Fetches approved products matching the given filters, plus a `hasMore`
 * flag for "Load more" pagination. All filtering happens in the query
 * itself (not client-side) so this scales past a handful of products.
 */
export async function fetchProducts(filters: ProductFilters) {
  const supabase = await createClient();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 12;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("products")
    .select(
      `id, name, slug, short_description, price_from, price_to, location,
       is_customizable, lead_time_days,
       category:categories(name, slug),
       product_images(image_url, sort_order)`,
      { count: "exact" }
    )
    .eq("approval_status", "approved")
    .eq("is_available", true)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.search) {
    query = query.ilike("name", `%${filters.search}%`);
  }
  if (filters.categorySlug) {
    // categories is a joined table — filter via a subquery-friendly `in`
    // on category_id would need a second round trip; simplest correct
    // approach with the JS client is filtering on the joined column name.
    query = query.eq("categories.slug", filters.categorySlug);
  }
  if (filters.location) {
    query = query.ilike("location", `%${filters.location}%`);
  }
  if (filters.minPrice !== undefined) {
    query = query.gte("price_to", filters.minPrice);
  }
  if (filters.maxPrice !== undefined) {
    query = query.lte("price_from", filters.maxPrice);
  }
  if (filters.customOnly) {
    query = query.eq("is_customizable", true);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error("fetchProducts error:", error);
    return { products: [] as ProductListItem[], hasMore: false, total: 0 };
  }

  const products: ProductListItem[] = (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    short_description: row.short_description,
    price_from: row.price_from,
    price_to: row.price_to,
    location: row.location,
    is_customizable: row.is_customizable,
    lead_time_days: row.lead_time_days,
    category: row.category ?? null,
    primary_image_url:
      (row.product_images ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order)[0]
        ?.image_url ?? null,
  }));

  const total = count ?? products.length;
  return { products, hasMore: from + products.length < total, total };
}

export async function fetchCategories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug")
    .eq("is_active", true)
    .order("name");

  if (error) {
    console.error("fetchCategories error:", error);
    return [];
  }
  return data;
}

export async function fetchProductBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      `*, category:categories(name, slug),
       product_images(image_url, alt_text, sort_order),
       artisan:artisans(id, business_name, location, craft_category, years_experience, verification_status, description)`
    )
    .eq("slug", slug)
    .eq("approval_status", "approved")
    .single();

  if (error || !data) return null;
  return data;
}
