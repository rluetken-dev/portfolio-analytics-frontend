// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// English comments inside code:
// Add a dev-server proxy so that requests to "/api/*" are forwarded
// from Vite (127.0.0.1:5173) to your .NET backend (http://localhost:5046).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5046", // backend port
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
