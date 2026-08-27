import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-md border border-border bg-white px-3 text-sm text-charcoal placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-forest disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
