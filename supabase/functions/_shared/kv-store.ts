import { getDatabaseClient } from "./db.ts";

type JsonValue = unknown;

export const set = async (key: string, value: JsonValue): Promise<void> => {
  const db = getDatabaseClient();
  await db`
    insert into kv_store_0f597298 (key, value)
    values (${key}, ${db.json(value)})
    on conflict (key) do update set value = excluded.value
  `;
};

export const get = async (key: string): Promise<JsonValue> => {
  const db = getDatabaseClient();
  const rows = await db<{ value: JsonValue }[]>`
    select value
    from kv_store_0f597298
    where key = ${key}
    limit 1
  `;
  return rows.length > 0 ? rows[0].value : undefined;
};

export const del = async (key: string): Promise<void> => {
  const db = getDatabaseClient();
  await db`
    delete from kv_store_0f597298
    where key = ${key}
  `;
};

export const mset = async (keys: string[], values: JsonValue[]): Promise<void> => {
  if (keys.length !== values.length) {
    throw new Error("Keys and values must have the same length.");
  }

  await Promise.all(keys.map((key, index) => set(key, values[index])));
};

export const mget = async (keys: string[]): Promise<JsonValue[]> => {
  if (keys.length === 0) {
    return [];
  }

  const db = getDatabaseClient();
  const rows = await db<{ value: JsonValue }[]>`
    select value
    from kv_store_0f597298
    where key = any(${db.array(keys)})
  `;

  return rows.map((row) => row.value ?? undefined);
};

export const mdel = async (keys: string[]): Promise<void> => {
  if (keys.length === 0) {
    return;
  }

  const db = getDatabaseClient();
  await db`
    delete from kv_store_0f597298
    where key = any(${db.array(keys)})
  `;
};

export const getByPrefix = async (prefix: string): Promise<JsonValue[]> => {
  const db = getDatabaseClient();
  const rows = await db<{ value: JsonValue }[]>`
    select value
    from kv_store_0f597298
    where key like ${prefix + "%"}
  `;

  return rows.map((row) => row.value ?? undefined);
};
