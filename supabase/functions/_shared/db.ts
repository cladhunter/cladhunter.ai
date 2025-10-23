import postgres from "npm:postgres";

type SqlClient = ReturnType<typeof postgres>;

let cachedClient: SqlClient | null = null;
let lastConfigError: Error | null = null;

function resolveDatabaseUrl(): string {
  const variableNames = [
    "POSTGRES_URL_NON_POOLING",
    "POSTGRES_PRISMA_URL",
    "POSTGRES_URL",
    "SUPABASE_DB_URL",
    "DATABASE_URL",
  ];

  for (const name of variableNames) {
    const value = Deno.env.get(name);
    if (value) {
      return value;
    }
  }

  const error = new Error(
    `Database connection string not configured. Set one of ${variableNames.join(", ")}.`,
  );
  lastConfigError = error;
  throw error;
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
