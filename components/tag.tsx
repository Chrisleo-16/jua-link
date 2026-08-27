// components/tag.tsx — a die-cut "workshop tag" shape, echoing the
// hand-written tags jua kali stalls hang off finished work. Reused
// for the hero photo caption and category cards.
import { cn } from "@/lib/utils";

export function Tag({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "relative inline-flex items-center gap-2 bg-background py-2 pl-6 pr-4 font-mono text-xs text-charcoal shadow-sm",
        className
      )}
      style={{ clipPath: "polygon(14% 0%, 100% 0%, 100% 100%, 14% 100%, 0% 50%)" }}
    >
      <span className="absolute left-[9%] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-charcoal/70" />
      {children}
    </div>
  );
}