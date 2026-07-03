import { spawnSync } from "node:child_process"

const connectionString =
  process.env.DIRECT_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL

const hasConnectionString = typeof connectionString === "string" && connectionString.trim().length > 0
const isProductionBuild = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production"

if (!hasConnectionString) {
  if (isProductionBuild) {
    console.error("Prisma migrations require DATABASE_URL, POSTGRES_URL, or POSTGRES_PRISMA_URL in production.")
    process.exit(1)
  }

  console.log("Skipping Prisma migrations because no database URL is configured.")
  process.exit(0)
}

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  env: {
    ...process.env,
    DATABASE_URL: connectionString,
  },
  stdio: "inherit",
  shell: process.platform === "win32",
})

if (result.error) {
  console.error("Failed to run Prisma migrations:", result.error.message)
  process.exit(1)
}

process.exit(result.status ?? 1)
