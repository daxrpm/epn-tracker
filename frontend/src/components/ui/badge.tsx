import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A status label, and the only pill-shaped thing in the interface — the shape is what marks it
 * as a label rather than a control.
 *
 * The academic-state variants carry the semantic colours from DESIGN.md. Colour alone never
 * conveys the state: a badge always shows its text too.
 */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs leading-5 font-medium whitespace-nowrap [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-muted-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        passed: "border-transparent bg-state-passed-soft text-state-passed",
        progress: "border-transparent bg-state-progress-soft text-state-progress",
        failed: "border-transparent bg-state-failed-soft text-state-failed",
        annulled: "border-transparent bg-state-annulled-soft text-state-annulled",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";
  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
