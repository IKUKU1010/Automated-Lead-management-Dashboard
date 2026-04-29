import { Hono } from "hono";
import db from "../db.js";

const settings = new Hono();

interface FaqRow { id: number; category: string; question: string; answer: string; keywords: string; }

// ─── FAQ CRUD — registered BEFORE /:key wildcard ──────────────────────────────

settings.get("/faq/all", (c) => {
  const rows = db.prepare("SELECT * FROM faq ORDER BY id ASC").all();
  return c.json(rows);
});

settings.post("/faq", async (c) => {
  const body = await c.req.json<Omit<FaqRow, "id">>();
  const result = db.prepare(
    "INSERT INTO faq (category, question, answer, keywords) VALUES (?,?,?,?)"
  ).run(body.category, body.question, body.answer, body.keywords ?? "");
  return c.json({ ok: true, id: result.lastInsertRowid }, 201);
});

settings.patch("/faq/:id", async (c) => {
  const id       = Number(c.req.param("id"));
  const body     = await c.req.json<Partial<Omit<FaqRow, "id">>>();
  const existing = db.prepare("SELECT * FROM faq WHERE id = ?").get(id) as FaqRow | undefined;
  if (!existing) return c.json({ error: "Not found" }, 404);
  db.prepare("UPDATE faq SET category=?, question=?, answer=?, keywords=? WHERE id=?").run(
    body.category ?? existing.category,
    body.question ?? existing.question,
    body.answer   ?? existing.answer,
    body.keywords ?? existing.keywords,
    id
  );
  return c.json({ ok: true });
});

settings.delete("/faq/:id", (c) => {
  const id = Number(c.req.param("id"));
  db.prepare("DELETE FROM faq WHERE id = ?").run(id);
  return c.json({ ok: true });
});

// ─── SETTINGS KEY/VALUE — after FAQ routes so /:key doesn't swallow /faq/* ───

settings.get("/", (c) => {
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return c.json(out);
});

settings.get("/:key", (c) => {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(c.req.param("key")) as { value: string } | undefined;
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json({ key: c.req.param("key"), value: row.value });
});

settings.patch("/", async (c) => {
  const body = await c.req.json<Record<string, string>>();
  const upsert = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')"
  );
  const updateMany = db.transaction((pairs: Record<string, string>) => {
    for (const [k, v] of Object.entries(pairs)) upsert.run(k, String(v));
  });
  updateMany(body);
  return c.json({ ok: true, updated: Object.keys(body).length });
});

export default settings;
