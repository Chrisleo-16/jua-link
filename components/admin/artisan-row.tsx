"use client";

import { useState, useTransition } from "react";
import { Pill, verificationTone } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { updateArtisanVerification, type AdminArtisanRow } from "@/lib/admin/artisans";
import type { VerificationStatus } from "@/lib/types";

export function ArtisanRow({ artisan }: { artisan: AdminArtisanRow }) {
  const [status, setStatus] = useState(artisan.verification_status);
  const [isPending, startTransition] = useTransition();

  function act(next: VerificationStatus) {
    startTransition(async () => {
      const result = await updateArtisanVerification(artisan.id, next);
      if (result.success) setStatus(next);
    });
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="p-3">
        <p className="font-medium text-charcoal">{artisan.business_name}</p>
        <p className="text-xs text-muted-foreground">{artisan.full_name}</p>
      </td>
      <td className="p-3 text-sm text-charcoal">{artisan.phone_number}</td>
      <td className="p-3 text-sm text-charcoal">{artisan.location}</td>
      <td className="p-3 text-sm text-charcoal">{artisan.craft_category}</td>
      <td className="p-3">
        <Pill tone={verificationTone(status)}>{status}</Pill>
      </td>
      <td className="p-3">
        <div className="flex gap-2">
          {status !== "VERIFIED" && (
            <Button size="sm" onClick={() => act("VERIFIED")} disabled={isPending}>
              Approve
            </Button>
          )}
          {status !== "REJECTED" && (
            <Button size="sm" variant="outline" onClick={() => act("REJECTED")} disabled={isPending}>
              Reject
            </Button>
          )}
          {status === "VERIFIED" && (
            <Button size="sm" variant="outline" onClick={() => act("SUSPENDED")} disabled={isPending}>
              Suspend
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
