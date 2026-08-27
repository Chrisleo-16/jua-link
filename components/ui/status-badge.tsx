import { OrderStatus, STATUS_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-3 py-1 text-xs font-medium",
        `status-${status.toLowerCase()}`,
        className
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
