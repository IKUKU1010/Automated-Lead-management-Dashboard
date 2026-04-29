import { Hono } from "hono";
import db from "../db.js";

const settings = new Hono();

// GET all settings — returns flat { key: value } object
settings.get("/", (c) => {
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return c.json(out);
});

// GET single setting
settings.get("/:key", (c) => {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(c.req.param("key")) as { value: string } | undefined;
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json({ key: c.req.param("key"), value: row.value });
});

// PATCH — update one or many settings at once
// Body: { key: value, key2: value2, ... }
settings.patch("/", async (c) => {
  const body = await c.req.json<Record<string, string>>();
  const upsert = db.prepare("INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')");
  const updateMany = db.transaction((pairs: Record<string, string>) => {
    for (const [k, v] of Object.entries(pairs)) upsert.run(k, String(v));
  });
  updateMany(body);
  return c.json({ ok: true, updated: Object.keys(body).length });
});

export default settings;
