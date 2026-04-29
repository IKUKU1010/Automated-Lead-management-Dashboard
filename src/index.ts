import "dotenv/config";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import leadsRouter    from "./routes/leads.js";
import respondRouter  from "./routes/respond.js";
import settingsRouter from "./routes/settings.js";
import db, { seedLeads } from "./db.js";

const app = new Hono();

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────

app.use("*", logger());
app.use("*", cors({ origin: "*" }));

// Redirect trailing slashes so /admin/ → /admin, etc.
app.use("*", async (c, next) => {
  const url = new URL(c.req.url);
  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
    return c.redirect(url.toString(), 301);
  }
  return next();
});

// ─── API ROUTES ───────────────────────────────────────────────────────────────

app.route("/api/leads",    leadsRouter);
app.route("/api/respond",  respondRouter);
app.route("/api/settings", settingsRouter);

app.get("/api/health", (c) =>
  c.json({ status: "ok", timestamp: new Date().toISOString(), env: process.env.NODE_ENV ?? "development" })
);

app.post("/api/admin/reseed", (c) => {
  db.exec("DELETE FROM leads");
  seedLeads();
  return c.json({ ok: true, msg: "All leads wiped and 10 mock leads reseeded." });
});

app.get("/api/admin/reseed", (c) => {
  db.exec("DELETE FROM leads");
  seedLeads();
  return c.json({ ok: true, msg: "All leads wiped and 10 mock leads reseeded." });
});

app.post("/api/admin/wipe-leads", (c) => {
  db.exec("DELETE FROM leads");
  return c.json({ ok: true, msg: "All leads wiped. Database is now empty." });
});

// ─── ADMIN PAGE ───────────────────────────────────────────────────────────────

app.get("/admin", (c) => {
  const total    = (db.prepare("SELECT COUNT(*) as n FROM leads").get() as { n: number }).n;
  const byStatus = db.prepare("SELECT status, COUNT(*) as n FROM leads GROUP BY status").all() as { status: string; n: number }[];
  const rows     = byStatus.map(r => `<tr><td>${r.status}</td><td>${r.n}</td></tr>`).join("");
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Admin — Premier Tree Dashboard</title>
  <style>
    body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;max-width:520px;margin:60px auto;padding:0 20px}
    h1{color:#4ade80;margin-bottom:4px}p{color:#94a3b8;margin-top:0}
    table{width:100%;border-collapse:collapse;margin:20px 0}
    th,td{text-align:left;padding:8px 12px;border-bottom:1px solid #1e293b}
    th{color:#64748b;font-size:12px;text-transform:uppercase}
    .btn{display:inline-block;margin:8px 8px 8px 0;padding:10px 20px;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer;border:none}
    .g{background:#22c55e;color:#000}.r{background:#ef4444;color:#fff}.b{background:#3b82f6;color:#fff}
    #msg{margin-top:16px;padding:12px 16px;border-radius:8px;background:#1e293b;color:#4ade80;display:none}
  </style>
</head>
<body>
  <h1>🌲 Admin Panel</h1>
  <p>Premier Tree Specialists — Lead Dashboard</p>
  <table>
    <tr><th>Metric</th><th>Count</th></tr>
    <tr><td>Total leads</td><td><strong>${total}</strong></td></tr>
    ${rows}
  </table>
  <button class="btn g" onclick="act('/api/admin/reseed','Reseeding...')">↺ Wipe &amp; reseed mock data</button>
  <button class="btn r" onclick="act('/api/admin/wipe-leads','Wiping...')">🗑 Wipe only</button>
  <button class="btn b" onclick="location.reload()">⟳ Refresh</button>
  <div id="msg"></div>
  <script>
    async function act(url,label){
      var m=document.getElementById('msg');
      m.textContent=label;m.style.display='block';
      try{
        var r=await fetch(url,{method:'POST'});
        var d=await r.json();
        m.textContent=d.msg||JSON.stringify(d);
        setTimeout(()=>location.reload(),1500);
      }catch(e){m.textContent='Error: '+e.message;m.style.color='#f87171';}
    }
  </script>
</body>
</html>`;
  return c.html(html);
});

// ─── STATIC FRONTEND ──────────────────────────────────────────────────────────
// In local dev, ./public doesn't exist because Vite runs separately on port 5173.
// Only serve static files when the production build is present (Railway).

import { existsSync } from "fs";
const PUBLIC_BUILT = existsSync("./public/index.html");

if (PUBLIC_BUILT) {
  app.use("/assets/*", serveStatic({ root: "./public" }));
  app.get("/tree.svg",  serveStatic({ root: "./public" }));
  app.get("*", async (c) => {
    if (c.req.path.startsWith("/api")) return c.json({ error: "Not found" }, 404);
    return serveStatic({ path: "./public/index.html" })(c, async () => {});
  });
} else {
  // Dev fallback — helpful redirect page
  app.get("*", (c) => {
    if (c.req.path.startsWith("/api") || c.req.path.startsWith("/admin"))
      return c.json({ error: "Not found" }, 404);
    return c.html(`<!DOCTYPE html><html><body style="font:14px system-ui;background:#060f0a;color:#94a3b8;padding:40px;font-family:system-ui">
      <h2 style="color:#4ade80;margin-bottom:8px">\u{1F332} Premier Tree — Backend running</h2>
      <p>Frontend is served by Vite in dev mode.</p>
      <p>Open <a href="http://localhost:5173" style="color:#38bdf8">http://localhost:5173</a> for the dashboard.</p>
      <p style="margin-top:16px"><a href="/admin" style="color:#38bdf8">Admin panel \u2192</a></p>
    </body></html>`);
  });
}

// ─── START ────────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 3000);

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`\n🌲 Premier Tree Dashboard running on http://localhost:${PORT}`);
  console.log(`   App:    http://localhost:${PORT}`);
  console.log(`   Admin:  http://localhost:${PORT}/admin`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  if (!process.env.OPENROUTER_API_KEY)  console.log("   ⚠️  OPENROUTER_API_KEY not set");
  if (!process.env.ARBOSTAR_COMPANY_ID) console.log("   ⚠️  ARBOSTAR credentials not set");
  if (!process.env.SENDGRID_API_KEY)    console.log("   ⚠️  SENDGRID_API_KEY not set");
  console.log("");
});
