const isDev = process.env.NODE_ENV === "development"

// Content-Security-Policy. Next injects inline bootstrap scripts (no nonce by
// default) so 'unsafe-inline' is required for script-src; 'unsafe-eval' is only
// needed by the dev runtime. Receipts are same-origin; data:/blob: cover inline
// images and the PWA icons.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
]
  .join("; ")

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Disable the client-side router cache for dynamic pages so that navigating
  // to /budgets always fetches a fresh server render rather than serving a
  // 30-second stale snapshot. Without this, revalidatePath from Route Handlers
  // has no effect on the in-memory router cache.
  experimental: {
    // A value of exactly 0 makes the client Router Cache entry for dynamic
    // routes invalid the instant it's written. Combined with the persistent,
    // always-on-screen nav links in AppNav.tsx, Next's background prefetch
    // scheduler re-issues the prefetch as soon as it goes stale — with 0 that's
    // immediate, causing a runaway prefetch loop (visible in dev as the target
    // route being refetched roughly once per second). 30s still refreshes much
    // more aggressively than the framework default (5 min) while avoiding the
    // 0ms retrigger window.
    staleTimes: { dynamic: 30 },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  customWorkerSrc: "worker",
  // PWA is now ON in dev too (so you can test install locally). The service
  // worker caches aggressively — if stale assets get annoying while coding, set
  // NEXT_PUBLIC_DISABLE_PWA=true in your env to turn it back off for `next dev`.
  // Must be NEXT_PUBLIC_ (not just server-side) because ServiceWorkerRegistrar
  // (a client component) reads the same flag to actively unregister any
  // leftover service worker + clear its caches — otherwise switching this flag
  // off leaves a stale worker from a previous session still controlling the
  // tab (this bit us: an old SW kept re-fetching pages in one browser profile
  // after PWA had been disabled in every other one).
  disable: process.env.NEXT_PUBLIC_DISABLE_PWA === "true",
  register: true,
  // Limit the service worker's control to the app origin.
  scope: "/",
  workboxOptions: {
    skipWaiting: true,
    // Security: only GET requests are ever cached (the workbox handlers below
    // only cache GET responses), and we explicitly avoid caching auth, mutations,
    // or sensitive per-user API/files. Anything not matched falls through to the
    // network.
    runtimeCaching: [
      // App-shell navigations: network-first so users get fresh pages, falling
      // back to cache when offline.
      {
        urlPattern: ({ request }) => request.mode === "navigate",
        handler: "NetworkFirst",
        options: {
          cacheName: "pages",
          networkTimeoutSeconds: 5,
          expiration: { maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 },
        },
      },
      // Build assets are content-hashed → safe to cache aggressively.
      {
        urlPattern: /\/_next\/static\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "next-static",
          expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
        },
      },
      {
        urlPattern: /\/_next\/image\?.*/i,
        handler: "StaleWhileRevalidate",
        options: { cacheName: "next-image", expiration: { maxEntries: 64 } },
      },
      // Static images/fonts/styles/scripts — but NEVER anything under /api
      // (that would catch receipt images at /api/uploads, which are sensitive).
      {
        urlPattern: ({ request, url }) =>
          ["image", "font", "style", "script", "worker"].includes(
            request.destination
          ) && !url.pathname.startsWith("/api/"),
        handler: "StaleWhileRevalidate",
        options: { cacheName: "assets", expiration: { maxEntries: 100 } },
      },
      // The ONLY API allowed in the cache: the dashboard summary, SWR for 5 min.
      {
        urlPattern: ({ url }) => url.pathname === "/api/dashboard",
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "api-dashboard",
          expiration: { maxEntries: 8, maxAgeSeconds: 5 * 60 },
        },
      },
    ],
  },
})

module.exports = withPWA(nextConfig)
