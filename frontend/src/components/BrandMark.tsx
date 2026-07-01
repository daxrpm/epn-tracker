import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("relative block size-6 text-foreground", className)}
    >
      <span className="absolute left-0.5 top-1 block size-2.5 rounded-[3px] bg-current" />
      <span className="absolute bottom-1 right-0.5 block size-2.5 rounded-[3px] bg-current" />
    </span>
  );
}
