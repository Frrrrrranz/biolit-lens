import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    modulePreload: {
      resolveDependencies: (_filename, deps) => deps.filter((dependency) => !dependency.includes("antd-vendor")),
    },
    rollupOptions: {
      output: {
        entryFileNames: "assets/landing-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        manualChunks(id) {
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) return "react-vendor";
          if (id.includes("node_modules/antd") || id.includes("node_modules/@ant-design")) return "antd-vendor";
          return undefined;
        },
      },
    },
  },
});
