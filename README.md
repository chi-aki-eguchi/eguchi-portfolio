# sandbox-app-template

Monorepo: Bun workspaces + Turborepo.

## Project Structure

```
.env                         Secrets (gitignored), loaded via Vite's loadEnv
packages/
  web/                       Unified server (API + web frontend via Vite)
    vite.config.ts           Vite 7 config — loads .env, sets port, registers plugins
    index.html               Frontend HTML entry
    vite/plugins/
      hono-dev-plugin.ts     Intercepts /api/* in dev, forwards to Hono via SSR
      runable-analytics-plugin.ts
    src/
      api/
        index.ts             Hono routes (.basePath('api')) + AppType export
        database/
          index.ts           Database client (Turso/LibSQL)
          schema.ts          Drizzle schema
      web/
        main.tsx             App entry
        app.tsx              Root component + Wouter routing
        pages/               Page components
        components/          UI components
        hooks/
        lib/
          api.ts             Typed API client (hono client)
          utils.ts           Shared utilities
        styles.css           Tailwind CSS entry
```

## Environment Variables

Secrets and credentials live in `.env` at the project root (gitignored). Vite's `loadEnv` loads them into `process.env` at dev/build time (configured in `packages/web/vite.config.ts`). In API code (Hono), use `process.env.YOUR_VAR`. In browser code, only `VITE_`-prefixed vars are exposed via `import.meta.env.VITE_YOUR_VAR`. Drizzle scripts use `bun --env-file=../../.env` to load env vars directly.

## Servers

Dev servers are started and managed automatically — no need to run them manually.

## Database

```sh
cd packages/web
bun run db:push        # Push schema to database
bun run db:generate    # Generate migration files
bun run db:migrate     # Run migrations
bun run db:studio      # Open Drizzle Studio
```
