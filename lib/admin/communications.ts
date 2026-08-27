import { createClient } from "@/lib/supabase/server";

export interface CommsSmsRow {
  id: string;
  direction: string;
  customer_phone: string;
  message_body: string;
  delivery_status: string | null;
  created_at: string;
  order_request: { order_reference: string } | null;
}

export interface CommsUssdRow {
  id: string;
  session_id: string;
  phone_number: string;
  current_step: string;
  text_input: string;
  completed: boolean;
  created_at: string;
}

export async function fetchSmsLog(limit = 100): Promise<CommsSmsRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sms_messages")
    .select(
      "id, direction, customer_phone, message_body, delivery_status, created_at, order_request:order_requests(order_reference)"
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as unknown as CommsSmsRow[]) ?? [];
}

export async function fetchUssdLog(limit = 100): Promise<CommsUssdRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ussd_sessions")
    .select("id, session_id, phone_number, current_step, text_input, completed, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
