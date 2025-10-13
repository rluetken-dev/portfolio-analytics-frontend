// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 🧠 Wichtig: WSL -> Windows IP (aus `ipconfig`)
const windowsHost = "172.30.176.1"; // <--- deine Windows-IP
const backendPort = 5046;

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0", // <-- erzwingt echten localhost für Proxy
    proxy: {
      "/api": {
        target: `http://${windowsHost}:${backendPort}`,
        changeOrigin: true,
        secure: false,
        // optional logging
        configure: (proxy) => {
          proxy.on("error", (err) => console.error("[Proxy Error]", err.message));
          proxy.on("proxyReq", (_, req) => console.log("[Proxy]", req.url));
        },
      },
    },
  },
});
