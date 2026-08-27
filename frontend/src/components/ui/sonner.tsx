import { Toaster as Sonner, type ToasterProps } from "sonner";

import { useThemeStore } from "@/stores/theme.store";

/**
 * Toasts follow the app's own theme store.
 *
 * This used to read `useTheme()` from next-themes, but no next-themes provider was ever mounted,
 * so the hook always fell back to "system" — a dark app on a light OS got white toasts.
 */
function Toaster(props: ToasterProps) {
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme);

  return (
    <Sonner
      theme={resolvedTheme}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-md)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
