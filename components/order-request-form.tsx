"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { submitOrderRequest } from "@/lib/orders/submit-order";

export function OrderRequestForm({ productId }: { productId: string }) {
  const [status, setStatus] = useState<"idle" | "submitting" | "error" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  const [orderReference, setOrderReference] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setStatus("submitting");
    setError(null);

    const result = await submitOrderRequest({
      productId,
      customerName: formData.get("customerName"),
      customerPhone: formData.get("customerPhone"),
      customerLocation: formData.get("customerLocation"),
      quantity: formData.get("quantity"),
      requestType: formData.get("requestType"),
      preferredTimeline: formData.get("preferredTimeline") || undefined,
      specialInstructions: formData.get("specialInstructions") || undefined,
      consentToContact: formData.get("consentToContact") === "on" ? true : undefined,
    });

    if (result.success) {
      setStatus("success");
      setOrderReference(result.orderReference);
    } else {
      setStatus("error");
      setError(result.error);
    }
  }

  if (status === "success" && orderReference) {
    return (
      <div className="rounded-lg border border-forest/30 bg-forest-soft p-5">
        <p className="text-sm text-muted-foreground">Order reference</p>
        <p className="font-display text-2xl font-semibold text-forest">{orderReference}</p>
        <p className="mt-2 text-sm text-charcoal">Status: Request submitted</p>
        <p className="mt-2 text-sm text-charcoal">
          We have notified the artisan. You will receive an SMS once they respond.
        </p>
        <a
          href={`/track-order?ref=${orderReference}`}
          className="mt-3 inline-block text-sm text-forest underline"
        >
          Track this order
        </a>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-4 rounded-lg border border-border bg-white p-5">
      <h3 className="font-medium text-charcoal">Request this product</h3>
      <p className="text-sm text-muted-foreground">
        This is a request. Final price, measurements, delivery, and payment are agreed after
        artisan confirmation.
      </p>

      <div>
        <Label htmlFor="customerName">Full name</Label>
        <Input id="customerName" name="customerName" required />
      </div>

      <div>
        <Label htmlFor="customerPhone">Phone number</Label>
        <Input
          id="customerPhone"
          name="customerPhone"
          placeholder="+2547XXXXXXXX"
          required
        />
      </div>

      <div>
        <Label htmlFor="customerLocation">Your location</Label>
        <Input id="customerLocation" name="customerLocation" required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="quantity">Quantity</Label>
          <Input id="quantity" name="quantity" type="number" min={1} defaultValue={1} required />
        </div>
        <div>
          <Label htmlFor="requestType">Request type</Label>
          <Select id="requestType" name="requestType" defaultValue="standard">
            <option value="standard">Standard product</option>
            <option value="custom">Custom product</option>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="preferredTimeline">Preferred timeline (optional)</Label>
        <Input id="preferredTimeline" name="preferredTimeline" placeholder="e.g. within 2 weeks" />
      </div>

      <div>
        <Label htmlFor="specialInstructions">Special instructions (optional)</Label>
        <Textarea id="specialInstructions" name="specialInstructions" maxLength={500} />
      </div>

      <label className="flex items-start gap-2 text-sm text-charcoal">
        <input type="checkbox" name="consentToContact" className="mt-1" required />
        I agree to be contacted by SMS or phone about this request.
      </label>

      {status === "error" && error && (
        <p className="text-sm text-rust" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={status === "submitting"}>
        {status === "submitting" ? "Submitting request…" : "Request Order"}
      </Button>
    </form>
  );
}
