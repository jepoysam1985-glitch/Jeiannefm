// /api/nowplaying
//  GET  -> { title, artist, cover, t }   (pinakabagong tumutugtog mula sa DJ app)
//  POST -> header x-admin-password (ADMIN_PASSWORD), body { title, artist, cover } o { clear:true }
const crypto = require("crypto");
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
const KEY = "jfm:nowplaying";
const mem = (globalThis.__jfmNp = globalThis.__jfmNp || { v: null });

async function kv(cmd) {
  const r = await fetch(URL_.replace(/\/$/, "") + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify([cmd]),
  });
  if (!r.ok) throw new Error("Storage error " + r.status);
  const o = await r.json();
  if (o[0] && o[0].error) throw new Error(o[0].error);
  return o[0] && o[0].result;
}
async function get() {
  if (!URL_ || !TOKEN) return mem.v;
  const v = await kv(["GET", KEY]);
  try { return v ? JSON.parse(v) : null; } catch (e) { return null; }
}
async function set(o) {
  if (!URL_ || !TOKEN) { mem.v = o; return; }
  if (!o) { await kv(["DEL", KEY]); return; }
  await kv(["SET", KEY, JSON.stringify(o), "EX", "43200"]);
}
const sha = (s) => crypto.createHash("sha256").update(String(s)).digest();
function authed(req) {
  const real = process.env.ADMIN_PASSWORD || "";
  const p = req.headers["x-admin-password"] || "";
  if (!real || !p) return false;
  return crypto.timingSafeEqual(sha(p), sha(real));
}
const clean = (s, max) => String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-password");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    if (req.method === "GET") {
      const v = await get();
      return res.status(200).send(JSON.stringify(v || {}));
    }
    if (req.method !== "POST") return res.status(405).send(JSON.stringify({ error: "Method not allowed" }));
    if (!authed(req)) {
      await new Promise((r) => setTimeout(r, 400));
      return res.status(401).send(JSON.stringify({ error: "Maling password." }));
    }
    let b = req.body;
    if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } }
    b = b && typeof b === "object" ? b : {};
    const title = clean(b.title, 200);
    if (b.clear || !title) { await set(null); return res.status(200).send(JSON.stringify({ ok: true, cleared: true })); }
    let cover = typeof b.cover === "string" ? b.cover : "";
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(cover) || cover.length > 200000) cover = "";
    await set({ title, artist: clean(b.artist, 120), cover, t: Date.now() });
    return res.status(200).send(JSON.stringify({ ok: true }));
  } catch (e) {
    return res.status(500).send(JSON.stringify({ error: String((e && e.message) || e) }));
  }
};
