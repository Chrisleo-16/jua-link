import { createClient } from "@/lib/supabase/server";

export interface AdminProfile {
  id: string;
  full_name: string;
}

/**
 * Confirms the caller is logged in AND has role='admin', returning their
 * profile if so. RLS policies already enforce this at the database level
 * (every admin table policy checks is_admin()), so a non-admin calling an
 * admin server action would fail anyway — this just turns that into a
 * clean, expected error message instead of a raw Postgres/RLS error
 * surfacing in the UI.
 */
export async function requireAdmin(): Promise<AdminProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") return null;

  return { id: profile.id, full_name: profile.full_name };
}
