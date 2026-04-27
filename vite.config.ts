import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import { visualizer } from "rollup-plugin-visualizer";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (id.includes("recharts")) {
            return "charts";
          }

            if (id.includes("d3")) {
              return "d3";
            }

          return undefined;
        },
      },
    },
  },
  plugins: [
    react(),
    mode === "analyze" ? visualizer({
      filename: "dist/bundle-analysis.html",
      gzipSize: true,
      brotliSize: true,
      open: false,
    }) : null,
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["robots.txt", "eduhub-logo.svg"],
      manifest: {
        name: "EduHub SA",
        short_name: "EduHub",
        description: "South African student educational resource platform",
        theme_color: "#2563eb",
        background_color: "#ffffff",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/eduhub-logo.svg",
            sizes: "1024x1024",
            type: "image/svg+xml",
            purpose: "any"
          },
          {
            src: "/eduhub-logo.svg",
            sizes: "1024x1024",
            type: "image/svg+xml",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,json}"],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/d64gsuwffb70l\.cloudfront\.net\/.*$/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "eduhub-image-cache",
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "eduhub-font-cache",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
