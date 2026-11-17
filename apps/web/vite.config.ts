import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In development the browser talks to Vite, and Vite forwards /api to our Express server.
    // Same address for both means no CORS setup is needed.
    proxy: { "/api": "http://127.0.0.1:3000" },
  },
});
