import { heroui } from "@heroui/react";

/**
 * HeroUI plugin configuration (loaded from index.css via `@plugin`).
 * Defines the light and dark themes and a shared primary palette.
 */
export default heroui({
  themes: {
    light: {
      colors: {
        background: "#ffffff",
        foreground: "#0f172a",
        primary: {
          DEFAULT: "#2563eb",
          foreground: "#ffffff",
        },
        focus: "#2563eb",
      },
    },
    dark: {
      colors: {
        background: "#0b0f19",
        foreground: "#e2e8f0",
        primary: {
          DEFAULT: "#3b82f6",
          foreground: "#ffffff",
        },
        focus: "#3b82f6",
      },
    },
  },
});
