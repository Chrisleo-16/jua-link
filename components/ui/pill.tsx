import { cn } from "@/lib/utils";

const TONE_CLASSES: Record<string, string> = {
  neutral: "bg-muted text-charcoal",
  positive: "bg-forest-soft text-forest",
  negative: "bg-rust-soft text-rust",
  warning: "bg-gold-soft text-charcoal",
};

export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "positive" | "negative" | "warning";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function verificationTone(status: string): "neutral" | "positive" | "negative" | "warning" {
  if (status === "VERIFIED") return "positive";
  if (status === "REJECTED" || status === "SUSPENDED") return "negative";
  return "warning"; // PENDING
}

export function approvalTone(status: string): "neutral" | "positive" | "negative" | "warning" {
  if (status === "approved") return "positive";
  if (status === "rejected" || status === "hidden") return "negative";
  return "warning"; // pending
}
