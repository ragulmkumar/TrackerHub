import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 3715,
    proxy: {
      "/api": {
        target: "http://backend:8022",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
