import { spawnSync } from "node:child_process"
import { readdirSync } from "node:fs"
import { join } from "node:path"

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

const commandEnv = {
  ...process.env,
  DATABASE_URL: connectionString,
}

function runPrisma(args) {
  const result = spawnSync("npx", ["prisma", ...args], {
    env: commandEnv,
    encoding: "utf8",
    shell: process.platform === "win32",
  })

  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)

  if (result.error) {
    console.error("Failed to run Prisma:", result.error.message)
    return { status: 1, output: result.error.message }
  }

  return {
    status: result.status ?? 1,
    output: `${result.stdout || ""}${result.stderr || ""}`,
  }
}

function migrationNames() {
  return readdirSync(join(process.cwd(), "prisma/migrations"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

const deployResult = runPrisma(["migrate", "deploy"])

if (deployResult.status === 0) {
  process.exit(0)
}

if (!deployResult.output.includes("P3005")) {
  process.exit(deployResult.status)
}

console.log("Production database has existing non-Prisma objects; bootstrapping Prisma schema with db push.")

const pushResult = runPrisma(["db", "push", "--skip-generate"])

if (pushResult.status !== 0) {
  process.exit(pushResult.status)
}

for (const migrationName of migrationNames()) {
  const resolveResult = runPrisma(["migrate", "resolve", "--applied", migrationName])

  if (resolveResult.status !== 0 && !resolveResult.output.includes("already applied")) {
    process.exit(resolveResult.status)
  }
}

const finalDeployResult = runPrisma(["migrate", "deploy"])
process.exit(finalDeployResult.status)
