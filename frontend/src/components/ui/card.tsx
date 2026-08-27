import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A sheet of paper: flat, hairline border, no shadow and no blur.
 *
 * Elevation is reserved for things that genuinely float (dialogs, menus, the mobile drawer), so
 * a card that lifts off the page would be lying about its depth. Where a group of items only
 * needs separating, prefer the `.rule-list` line from the stylesheet over wrapping each one in
 * its own card.
 */
function Card({
  className,
  focal = false,
  ...props
}: React.ComponentProps<"div"> & {
  /** The single most important surface on the screen; takes the largest radius. */
  focal?: boolean;
}) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col border border-border bg-card text-card-foreground",
        focal ? "rounded-lg" : "rounded-md",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col gap-1 p-4 pb-0", className)}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <h3
      data-slot="card-title"
      className={cn("font-heading text-base leading-snug font-semibold", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("p-4", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center gap-2 border-t border-border p-4", className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
