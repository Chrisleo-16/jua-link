"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { trackOrder, type TrackedOrder } from "@/lib/orders/track-order";
import { ORDER_STATUSES } from "@/lib/types";

export default function TrackOrderPage() {
  const [state, setState] = useState<"idle" | "loading" | "error" | "found">("idle");
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<TrackedOrder | null>(null);

  async function handleSubmit(formData: FormData) {
    setState("loading");
    setError(null);

    const result = await trackOrder({
      orderReference: formData.get("orderReference"),
      phoneNumber: formData.get("phoneNumber"),
    });

    if (result.success) {
      setOrder(result.order);
      setState("found");
    } else {
      setError(result.error);
      setState("error");
    }
  }

  // A simple visual sense of progress through the lifecycle. Cancelled and
  // declined are terminal-but-not-forward-progress, so they're called out
  // separately rather than plotted on the same line.
  const stepIndex = order ? ORDER_STATUSES.indexOf(order.status) : -1;
  const isTerminalNegative = order?.status === "DECLINED" || order?.status === "CANCELLED";

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-charcoal">Track your order</h1>
      <p className="mt-1 text-muted-foreground">
        Enter your order reference and the phone number you used when you submitted it.
      </p>

      <form action={handleSubmit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="orderReference">Order reference</Label>
          <Input id="orderReference" name="orderReference" placeholder="JL-2048" required />
        </div>
        <div>
          <Label htmlFor="phoneNumber">Phone number</Label>
          <Input id="phoneNumber" name="phoneNumber" placeholder="+2547XXXXXXXX" required />
        </div>
        <Button type="submit" className="w-full" disabled={state === "loading"}>
          {state === "loading" ? "Looking up…" : "Track order"}
        </Button>
      </form>

      {state === "error" && error && (
        <p className="mt-4 text-sm text-rust" role="alert">
          {error}
        </p>
      )}

      {state === "found" && order && (
        <div className="mt-8 rounded-lg border border-border bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="font-display text-xl font-semibold text-charcoal">
              {order.order_reference}
            </p>
            <StatusBadge status={order.status} />
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Product</dt>
              <dd className="text-charcoal">{order.product_name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Quantity</dt>
              <dd className="text-charcoal">{order.quantity}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Last updated</dt>
              <dd className="text-charcoal">{new Date(order.updated_at).toLocaleString()}</dd>
            </div>
          </dl>

          {!isTerminalNegative && (
            <div className="mt-5">
              <div className="h-1.5 w-full rounded-full bg-muted">
                <div
                  className="h-1.5 rounded-full bg-forest transition-all"
                  style={{
                    width: `${Math.max(8, ((stepIndex + 1) / ORDER_STATUSES.length) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          <p className="mt-5 text-sm text-muted-foreground">
            Questions about this order? Contact JuaLink support at{" "}
            <a href="tel:+254700000000" className="text-forest underline">
              +254 700 000 000
            </a>
            .
          </p>
        </div>
      )}
    </main>
  );
}
