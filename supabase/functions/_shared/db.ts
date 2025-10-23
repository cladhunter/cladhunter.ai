import postgres from "npm:postgres";

type SqlClient = ReturnType<typeof postgres>;

let cachedClient: SqlClient | null = null;
let lastConfigError: Error | null = null;

function resolveDatabaseUrl(): string {
  const connectionString =
    Deno.env.get("POSTGRES_URL_NON_POOLING") ??
    Deno.env.get("POSTGRES_PRISMA_URL") ??
    Deno.env.get("POSTGRES_URL");

  if (!connectionString) {
    const error = new Error(
      "Database connection string not configured. Set POSTGRES_URL_NON_POOLING, POSTGRES_PRISMA_URL, or POSTGRES_URL.",
    );
    lastConfigError = error;
    throw error;
  }

  return connectionString;
}

function createClient(): SqlClient {
  const connectionString = resolveDatabaseUrl();

  try {
    const client = postgres(connectionString, {
      ssl: "require",
      max: 1,
      idle_timeout: 20,
      keep_alive: 5,
      prepare: false,
    });
    lastConfigError = null;
    return client;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    lastConfigError = err;
    throw err;
  }
}

export function getDatabaseClient(): SqlClient {
  if (!cachedClient) {
    cachedClient = createClient();
  }
  return cachedClient;
}

export function getDatabaseConfigError(): string | null {
  if (lastConfigError) {
    return lastConfigError.message;
  }

  try {
    getDatabaseClient();
    return null;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    lastConfigError = err;
    return err.message;
  }
}
