// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null,
        devOptions: { enabled: false },
        filename: "sw.js",
        manifest: false, // public/manifest.webmanifest already exists
        workbox: {
          globPatterns: ["assets/**/*.{js,css,png,svg,woff2}", "icons/*.png", "favicon.png", "manifest.webmanifest"],
          navigateFallbackDenylist: [/^\/~oauth/],
          runtimeCaching: [
            {
              // App pages: also matched for the warm-up fetches in sw-register so every page opens offline.
              urlPattern: ({ request, url, sameOrigin }: { request: Request; url: URL; sameOrigin: boolean }) =>
                sameOrigin && !url.pathname.startsWith("/~oauth") &&
                (request.mode === "navigate" || ["/", "/front-desk", "/reservations", "/rooms", "/restaurant", "/reports", "/backup", "/staff"].includes(url.pathname)),
              handler: "NetworkFirst",
              options: { cacheName: "pages", networkTimeoutSeconds: 3, matchOptions: { ignoreSearch: true } },
            },
            {
              urlPattern: ({ url, sameOrigin }: { url: URL; sameOrigin: boolean }) =>
                sameOrigin && /\/assets\/.+\.(js|css|png|woff2?)$/.test(url.pathname),
              handler: "CacheFirst",
              options: { cacheName: "assets", expiration: { maxEntries: 100, maxAgeSeconds: 2592000 } },
            },
          ],
        },
      }),
    ],
  },
});
