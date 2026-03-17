import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

function requireAnyEnv(keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  throw new Error(
    `Missing required environment variable. Provide one of: ${keys.join(", ")}`,
  );
}

function toLibpqCompatSslUrl(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    url.searchParams.set("sslmode", "require");
    url.searchParams.set("uselibpqcompat", "true");
    return url.toString();
  } catch {
    return connectionString;
  }
}

const rawConnectionUrl = requireAnyEnv(["DATABASE_URL", "DIRECT_URL"]);
const dbSslInsecure =
  (process.env.DB_SSL_INSECURE || "false").toLowerCase() === "true";
const effectiveConnectionUrl = dbSslInsecure
  ? toLibpqCompatSslUrl(rawConnectionUrl)
  : rawConnectionUrl;

const pgPool = new Pool({
  connectionString: effectiveConnectionUrl,
  ssl: dbSslInsecure ? { rejectUnauthorized: false } : undefined,
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg(pgPool),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
