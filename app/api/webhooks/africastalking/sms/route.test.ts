import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type Row = Record<string, unknown>;

function createSupabaseMock(seed?: {
  smsMessages?: Row[];
  artisans?: Row[];
  orderRequests?: Row[];
}) {
  const state = {
    smsMessages: [...(seed?.smsMessages ?? [])],
    artisans: [...(seed?.artisans ?? [])],
    orderRequests: [...(seed?.orderRequests ?? [])],
    orderStatusEvents: [] as Row[],
  };

  function matches(row: Row, filters: Record<string, unknown>) {
    return Object.entries(filters).every(([key, value]) => row[key] === value);
  }

  function makeQuery(table: string) {
    const filters: Record<string, unknown> = {};
    let orderedAsc = false;
    let limitedTo: number | null = null;
    let updatePayload: Row | null = null;

    const query = {
      select() {
        return query;
      },
      eq(column: string, value: unknown) {
        filters[column] = value;
        return query;
      },
      order(column: string, opts: { ascending: boolean }) {
        if (column === "created_at" && opts.ascending) orderedAsc = true;
        return query;
      },
      limit(n: number) {
        limitedTo = n;
        return query;
      },
      maybeSingle: async () => {
        let rows: Row[] = [];

        if (table === "sms_messages") rows = state.smsMessages;
        if (table === "order_requests") rows = state.orderRequests;

        let filtered = rows.filter((r) => matches(r, filters));
        if (orderedAsc) {
          filtered = filtered.sort((a, b) =>
            String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""))
          );
        }
        if (limitedTo != null) filtered = filtered.slice(0, limitedTo);

        return { data: filtered[0] ?? null, error: null };
      },
      single: async () => {
        let rows: Row[] = [];

        if (table === "artisans") rows = state.artisans;
        if (table === "order_requests") rows = state.orderRequests;

        let filtered = rows.filter((r) => matches(r, filters));
        if (orderedAsc) {
          filtered = filtered.sort((a, b) =>
            String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""))
          );
        }
        if (limitedTo != null) filtered = filtered.slice(0, limitedTo);

        return { data: filtered[0] ?? null, error: null };
      },
      insert: async (payload: Row) => {
        if (table === "sms_messages") state.smsMessages.push(payload);
        if (table === "order_status_events") state.orderStatusEvents.push(payload);
        return { error: null };
      },
      update(payload: Row) {
        updatePayload = payload;
        return {
          eq: async (column: string, value: unknown) => {
            if (table === "order_requests") {
              const target = state.orderRequests.find((row) => row[column] === value);
              if (target && updatePayload) Object.assign(target, updatePayload);
            }
            return { error: null };
          },
        };
      },
    };

    return query;
  }

  const supabase = {
    from(table: string) {
      return makeQuery(table);
    },
  };

  return { supabase, state };
}

const notifyCustomerOnStatusChange = vi.fn();
const handleArtisanOnboardingSms = vi.fn();

vi.mock("@/lib/orders/status-sms", () => ({
  notifyCustomerOnStatusChange,
}));

vi.mock("@/lib/artisans/sms-onboarding", () => ({
  handleArtisanOnboardingSms,
}));

describe("SMS webhook route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    handleArtisanOnboardingSms.mockResolvedValue({ handled: false });
    process.env.AFRICASTALKING_SMS_WEBHOOK_SECRET = "test-secret";
  });

  it("short-circuits when onboarding flow handles the message", async () => {
    handleArtisanOnboardingSms.mockResolvedValueOnce({
      handled: true,
      status: "onboarding_started",
    });

    const mock = createSupabaseMock();
    vi.doMock("@/lib/supabase/server", () => ({
      createServiceRoleClient: () => mock.supabase,
    }));

    const { POST } = await import("@/app/api/webhooks/africastalking/sms/route");

    const req = new NextRequest("http://localhost/api/webhooks/africastalking/sms?token=test-secret", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ from: "+254700111111", text: "JOIN", id: "msg-join-1" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(body).toEqual({ status: "onboarding_started", reason: undefined });
    expect(handleArtisanOnboardingSms).toHaveBeenCalledTimes(1);
    expect(notifyCustomerOnStatusChange).not.toHaveBeenCalled();
  });

  it("ignores duplicate inbound message ids", async () => {
    const mock = createSupabaseMock({
      smsMessages: [{ direction: "inbound", africa_talking_message_id: "dup-1" }],
    });

    vi.doMock("@/lib/supabase/server", () => ({
      createServiceRoleClient: () => mock.supabase,
    }));

    const { POST } = await import("@/app/api/webhooks/africastalking/sms/route");

    const req = new NextRequest("http://localhost/api/webhooks/africastalking/sms?token=test-secret", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ from: "+254700111111", text: "1", id: "dup-1" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(body).toEqual({ status: "ignored", reason: "duplicate_message" });
    expect(notifyCustomerOnStatusChange).not.toHaveBeenCalled();
  });

  it("logs unknown senders and exits", async () => {
    const mock = createSupabaseMock();
    vi.doMock("@/lib/supabase/server", () => ({
      createServiceRoleClient: () => mock.supabase,
    }));

    const { POST } = await import("@/app/api/webhooks/africastalking/sms/route");

    const req = new NextRequest("http://localhost/api/webhooks/africastalking/sms?token=test-secret", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ from: "+254700111111", text: "1", id: "msg-1" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(body).toEqual({ status: "ignored", reason: "unknown sender" });
    expect(mock.state.smsMessages.at(-1)?.processing_result).toBe("unmatched_sender");
    expect(notifyCustomerOnStatusChange).not.toHaveBeenCalled();
  });

  it("logs parse failures and keeps order pending", async () => {
    const mock = createSupabaseMock({
      artisans: [{ id: "a1", business_name: "A1", phone_number: "+254700111111" }],
    });
    vi.doMock("@/lib/supabase/server", () => ({
      createServiceRoleClient: () => mock.supabase,
    }));

    const { POST } = await import("@/app/api/webhooks/africastalking/sms/route");

    const req = new NextRequest("http://localhost/api/webhooks/africastalking/sms?token=test-secret", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ from: "+254700111111", text: "maybe", id: "msg-2" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(body).toEqual({ status: "unrecognized_reply" });
    expect(mock.state.smsMessages.at(-1)?.processing_result).toBe("parse_failed");
    expect(notifyCustomerOnStatusChange).not.toHaveBeenCalled();
  });

  it("processes valid referenced replies and notifies customer", async () => {
    const mock = createSupabaseMock({
      artisans: [{ id: "a1", business_name: "WoodWorks", phone_number: "+254700111111" }],
      orderRequests: [
        {
          id: "o1",
          order_reference: "JL-2048",
          artisan_id: "a1",
          customer_phone: "+254711222333",
          status: "PENDING_ARTISAN_CONFIRMATION",
          created_at: "2026-08-27T09:00:00.000Z",
        },
      ],
    });
    vi.doMock("@/lib/supabase/server", () => ({
      createServiceRoleClient: () => mock.supabase,
    }));

    const { POST } = await import("@/app/api/webhooks/africastalking/sms/route");

    const req = new NextRequest("http://localhost/api/webhooks/africastalking/sms?token=test-secret", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ from: "+254700111111", text: "JL-2048 1", id: "msg-3" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(body).toEqual({ status: "processed", newStatus: "ACCEPTED" });
    expect(mock.state.orderRequests[0].status).toBe("ACCEPTED");
    expect(notifyCustomerOnStatusChange).toHaveBeenCalledTimes(1);
    expect(notifyCustomerOnStatusChange).toHaveBeenCalledWith({
      orderRequestId: "o1",
      orderReference: "JL-2048",
      customerPhone: "+254711222333",
      status: "ACCEPTED",
      workshopName: "WoodWorks",
    });
  });
});
