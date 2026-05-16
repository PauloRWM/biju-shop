import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// PWA / Service Worker REMOVIDO temporariamente.
// Estava causando telas brancas aleatórias em alguns clientes. O kill switch
// em src/main.tsx limpa qualquer SW antigo registrado nos navegadores.
// O cache continua via Cache-Control HTTP (.htaccess), que é suficiente.

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: '/',
  server: {
    host: "::",
    port: parseInt(process.env.PORT || '5173'),
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
