# Runable AI Publish Handoff

This repo deploys as a Runable site through a prepared ZIP bundle.

## Before Publishing

1. Run the project deploy check from the repository root:

   ```sh
   bun run deploy
   ```

2. Confirm the command ends with:

   ```text
   デプロイ可能な状態の ZIP を更新しました
   ```

3. Publish the generated root ZIP:

   ```text
   eguchi-portfolio-deploy.zip
   ```

Do not upload `deploys/*.zip` unless the user explicitly asks for a timestamped archive. The root ZIP is the current publish artifact.

## Runtime

- Runable routes to `packages/web/website.config.json` port `8080`.
- Production startup is PM2 via `ecosystem.config.cjs`.
- PM2 runs `bun src/server.ts` from `packages/web`.
- `ecosystem.config.cjs` attempts `bun run db:push` and `bunx vite build` before the server starts.

## Required Environment Variables

Keep these in Runable secrets, never in the ZIP:

```text
DATABASE_URL
DATABASE_AUTH_TOKEN
S3_ENDPOINT
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
S3_BUCKET
ADMIN_PASSWORD
PORT=8080
```

## Publish Safety Notes

- The deploy script excludes `.env`, `node_modules`, build output, screenshots, root PNG work images, `.claude`, and `.codex`.
- If `bun run deploy` fails, do not publish the existing ZIP as a "best effort" artifact.
- After publish, smoke-check `/`, `/gallery`, `/series`, `/about`, `/contact`, and `/api/settings`.
