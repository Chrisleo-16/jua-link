import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Server Component / Server Action client — respects the logged-in user's
 * session and RLS policies. Use this everywhere EXCEPT the SMS/USSD
 * webhooks (see below).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component with no request/response —
            // safe to ignore if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}

/**
 * Service-role client — bypasses RLS entirely. Only use this from trusted
 * server-side code that isn't tied to a logged-in user, like the Africa's
 * Talking webhooks (an inbound SMS has no Supabase session attached to it).
 *
 * NEVER import this file into a Client Component or expose
 * SUPABASE_SERVICE_ROLE_KEY via NEXT_PUBLIC_*.
 */
export function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
