import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In development the browser talks to Vite, and Vite forwards /api to our Express server.
    // Same address for both means no CORS setup is needed.
    // API_URL lets a second API (e.g. an in-memory one for demos) be used without editing this file
    proxy: { "/api": process.env["API_URL"] ?? "http://127.0.0.1:3000" },
  },
});
