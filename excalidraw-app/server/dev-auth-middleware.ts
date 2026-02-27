import type { Plugin } from "vite";

interface DevAuthOptions {
  username?: string;
  email?: string;
  name?: string;
  avatarUrl?: string | null;
}

/**
 * Vite plugin that mocks /api/auth/me in development.
 * Returns a fake user so the app can be developed without Authentik.
 * Enable via VITE_APP_DEV_AUTH_MOCK=true in .env.development
 * Configure the mock user via VITE_APP_DEV_AUTH_USERNAME / EMAIL / NAME.
 */
export const devAuthMiddleware = (opts: DevAuthOptions = {}): Plugin => ({
  name: "dev-auth-middleware",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url === "/api/auth/me") {
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            authenticated: true,
            username: opts.username || "dev-user",
            email: opts.email || "dev@localhost",
            name: opts.name || "Dev User",
            groups: ["developers"],
            avatarUrl: opts.avatarUrl ?? null,
          }),
        );
        return;
      }
      next();
    });
  },
});
