"use client";

import { useState, useTransition } from "react";
import { Pill, approvalTone } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { setProductApproval, deleteProduct, type AdminProductRow } from "@/lib/admin/products";

export function ProductRow({ product }: { product: AdminProductRow }) {
  const [status, setStatus] = useState(product.approval_status);
  const [removed, setRemoved] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (removed) return null;

  return (
    <tr className="border-b border-border last:border-0">
      <td className="p-3">
        <p className="font-medium text-charcoal">{product.name}</p>
        <p className="text-xs text-muted-foreground">{product.artisan?.business_name}</p>
      </td>
      <td className="p-3 text-sm text-charcoal">{product.category?.name}</td>
      <td className="p-3 text-sm text-charcoal">
        {product.price_from ? `KSh ${Number(product.price_from).toLocaleString()}+` : "—"}
      </td>
      <td className="p-3">
        <Pill tone={approvalTone(status)}>{status}</Pill>
      </td>
      <td className="p-3">
        <div className="flex gap-2">
          {status !== "approved" && (
            <Button
              size="sm"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const r = await setProductApproval(product.id, "approved");
                  if (r.success) setStatus("approved");
                })
              }
            >
              Approve
            </Button>
          )}
          {status !== "hidden" && (
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const r = await setProductApproval(product.id, "hidden");
                  if (r.success) setStatus("hidden");
                })
              }
            >
              Hide
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
                const r = await deleteProduct(product.id);
                if (r.success) setRemoved(true);
              })
            }
          >
            Delete
          </Button>
        </div>
      </td>
    </tr>
  );
}
