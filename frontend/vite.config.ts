import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const API_PROXY = {
  "/api": {
    target: process.env.VITE_PROXY_TARGET ?? "http://localhost:8000",
    changeOrigin: true,
  },
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    // Proxy API calls to the backend during development to avoid CORS friction.
    proxy: API_PROXY,
  },
  // `vite preview` serves the production build; it needs the same proxy to be usable for
  // verifying a build against a real backend.
  preview: {
    port: 5173,
    proxy: API_PROXY,
  },
  build: {
    rollupOptions: {
      output: {
        // Split large vendors into cacheable chunks for faster repeat loads.
        // React and the query client are on every route, so they get their own long-lived
        // chunks. Everything else is split by route (see src/router.tsx).
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          query: ["@tanstack/react-query"],
        },
      },
    },
  },
});
