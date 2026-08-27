import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * `text-base` on small screens is deliberate: anything under 16px makes iOS Safari zoom the
 * viewport on focus, which on the gradebook means the page jumps every time you enter a grade.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-sm border border-input bg-card px-2.5 py-1 text-base transition-colors outline-none",
        "placeholder:text-muted-foreground",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive",
        "file:mr-2 file:inline-flex file:h-7 file:cursor-pointer file:rounded-sm file:border-0 file:bg-secondary file:px-2 file:text-sm file:font-medium file:text-secondary-foreground",
        "sm:text-sm",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";

export { Input };
