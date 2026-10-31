import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "vendor-react", test: /node_modules\/(react|react-dom|react-router|react-router-dom)\// },
            { name: "vendor-refine", test: /node_modules\/@refinedev\// },
            { name: "vendor-supabase", test: /node_modules\/@supabase\// },
            { name: "vendor-icons", test: /node_modules\/lucide-react\// },
          ],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
