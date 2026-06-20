import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/api/database/schema.postgres.ts",
  out: "./drizzle-postgres",
});
