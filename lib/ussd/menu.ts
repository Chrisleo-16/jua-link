import { createServiceRoleClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// How USSD state works here
//
// Africa's Talking sends the FULL accumulated `text` on every single
// request — e.g. after a user has dialed in, picked "2", then category "1",
// then product "3", the next request arrives with text = "2*1*3". There is
// no server-side session to read from; the entire journey so far is that
// string. So the only state we need is: split `text` on '*', and the
// resulting array's LENGTH tells us which step we're on, and its VALUES
// tell us what was picked at each step.
//
// The one thing this requires us to get right: any menu we show (categories,
// products) must be fetched in the *same deterministic order* every time,
// because the user's next input is just "the number they saw," not an ID.
// We always order by `name` for exactly this reason.
// ---------------------------------------------------------------------------

export interface MenuCategory {
  id: string;
  name: string;
}

export interface MenuProduct {
  id: string;
  name: string;
  price_from: number | null;
}

export async function getCategoriesForMenu(): Promise<MenuCategory[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name")
    .eq("is_active", true)
    .order("name")
    .limit(9); // USSD menus should stay short — 9 keeps single-digit input valid
  return data ?? [];
}

export async function getProductsForCategory(
  categoryId: string,
  limit = 5
): Promise<MenuProduct[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, price_from")
    .eq("category_id", categoryId)
    .eq("approval_status", "approved")
    .eq("is_available", true)
    .order("name")
    .limit(limit);
  return data ?? [];
}

export function renderCategoryMenu(categories: MenuCategory[], title: string): string {
  const lines = categories.map((c, i) => `${i + 1}. ${c.name}`);
  return `CON ${title}\n${lines.join("\n")}`;
}

export function renderProductMenu(products: MenuProduct[], title: string): string {
  if (products.length === 0) {
    return `END No products currently listed in that category. Please try another category.`;
  }
  const lines = products.map((p, i) => {
    const price = p.price_from ? `KSh ${Number(p.price_from).toLocaleString()}+` : "Price on request";
    return `${i + 1}. ${p.name} (${price})`;
  });
  return `CON ${title}\n${lines.join("\n")}`;
}

/** Picks item N (1-indexed, as shown to the user) from a list, or null if
 *  the input was out of range / not a number. */
export function pickFromMenu<T>(items: T[], rawInput: string): T | null {
  const index = Number(rawInput);
  if (!Number.isInteger(index) || index < 1 || index > items.length) return null;
  return items[index - 1];
}
