import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // For gh-pages: set to your repo name, e.g. "/worldbuilder-client/"
  // Using "./" works with HashRouter for any deployment path
  base: "./",
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          mui: ["@mui/material", "@mui/icons-material"],
          react: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
});
