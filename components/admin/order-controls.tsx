"use client";

import { useState, useTransition } from "react";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { updateOrderStatus, sendManualSms, toggleFollowUp } from "@/lib/admin/orders";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/types";

export function OrderControls({
  orderId,
  currentStatus,
  needsFollowUp,
}: {
  orderId: string;
  currentStatus: OrderStatus;
  needsFollowUp: boolean;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [note, setNote] = useState("");
  const [followUp, setFollowUp] = useState(needsFollowUp);
  const [smsText, setSmsText] = useState("");
  const [smsSent, setSmsSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleStatusUpdate(nextStatus: OrderStatus) {
    setError(null);
    startTransition(async () => {
      const result = await updateOrderStatus(orderId, nextStatus, note || undefined);
      if (result.success) {
        setStatus(nextStatus);
        setNote("");
      } else {
        setError(result.error);
      }
    });
  }

  function handleSendSms() {
    setError(null);
    setSmsSent(false);
    startTransition(async () => {
      const result = await sendManualSms(orderId, smsText);
      if (result.success) {
        setSmsSent(true);
        setSmsText("");
      } else {
        setError(result.error);
      }
    });
  }

  function handleToggleFollowUp() {
    const next = !followUp;
    startTransition(async () => {
      const result = await toggleFollowUp(orderId, next);
      if (result.success) setFollowUp(next);
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-white p-4">
        <p className="text-sm font-medium text-charcoal">Update status</p>
        <div className="mt-2 flex gap-2">
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as OrderStatus)}
            className="flex-1"
          >
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
          <Button onClick={() => handleStatusUpdate(status)} disabled={isPending}>
            Apply
          </Button>
        </div>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional internal note about this change"
          className="mt-2"
          rows={2}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Ready / Completed / Cancelled automatically text the customer. Other internal statuses
          do not.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-white p-4">
        <p className="text-sm font-medium text-charcoal">Send manual SMS to customer</p>
        <Textarea
          value={smsText}
          onChange={(e) => setSmsText(e.target.value)}
          placeholder="Type a message…"
          className="mt-2"
          rows={2}
        />
        <Button
          className="mt-2"
          variant="outline"
          onClick={handleSendSms}
          disabled={isPending || !smsText.trim()}
        >
          Send SMS
        </Button>
        {smsSent && <p className="mt-1 text-sm text-forest">Sent.</p>}
      </div>

      <div className="rounded-lg border border-border bg-white p-4">
        <label className="flex items-center justify-between text-sm text-charcoal">
          <span>Needs follow-up</span>
          <input
            type="checkbox"
            checked={followUp}
            onChange={handleToggleFollowUp}
            disabled={isPending}
          />
        </label>
      </div>

      {error && (
        <p className="text-sm text-rust" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
