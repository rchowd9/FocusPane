import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  worker: {
    format: "es",
  },
  optimizeDeps: {
    // Transformers.js ships its own WASM/ONNX assets; let it resolve them at runtime
    exclude: ["@huggingface/transformers"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          cytoscape: ["cytoscape"],
        },
      },
    },
  },
});
