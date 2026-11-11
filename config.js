// GET  /api/config  -> ibinabalik ang naka-save na settings (JSON)
// POST /api/config  -> { password, check:true }  o  { password, config:{...} }
const crypto = require("crypto");
const store = require("./_store");

const KEY = "jfm:config";
const sha = (s) => crypto.createHash("sha256").update(String(s)).digest();

function passwordOk(p) {
  const real = process.env.ADMIN_PASSWORD || "";
  if (!real || typeof p !== "string") return false;
  return crypto.timingSafeEqual(sha(p), sha(real));
}

const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
const url = (v) => (/^https?:\/\/[^\s]+$/i.test(str(v, 600)) ? str(v, 600) : "");
const tag = (v, max) => str(v, max).replace(/<(?!\/?span>)[^>]*>/gi, "");

function sanitize(c) {
  c = c && typeof c === "object" ? c : {};
  const out = {};
  const logo = str(c.logo, 900000);
  out.logo = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(logo) ? logo : "";
  out.adImg = str(c.adImg, 300);
  out.adLink = url(c.adLink);
  out.streamUrl = url(c.streamUrl);
  out.about = str(c.about, 400);
  out.fbUrl = url(c.fbUrl);
  out.dlUrl = url(c.dlUrl);
  out.djText = str(c.djText, 60);
  out.t = {};
  if (c.t && typeof c.t === "object") {
    Object.keys(c.t).slice(0, 60).forEach((k) => {
      if (/^[A-Za-z0-9_]{1,30}$/.test(k) && typeof c.t[k] === "string") out.t[k] = c.t[k].slice(0, 300);
    });
  }
  out.raw = Array.isArray(c.raw)
    ? c.raw.slice(0, 12).map((r) => [str(r && r[0], 120), str(r && r[1], 200)])
    : [];
  out.banners = Array.isArray(c.banners)
    ? c.banners.slice(0, 12).map((b) => ({ title: tag(b && b.title, 300), text: str(b && b.text, 200) }))
    : [];
  return out;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  try {
    if (req.method === "GET") {
      const c = await store.getJSON(KEY);
      return res.status(200).send(JSON.stringify(c || {}));
    }
    if (req.method !== "POST") return res.status(405).send(JSON.stringify({ error: "Method not allowed" }));

    if (!process.env.ADMIN_PASSWORD)
      return res.status(500).send(JSON.stringify({ error: "Walang ADMIN_PASSWORD sa Vercel Environment Variables." }));

    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};

    if (!passwordOk(body.password)) {
      await new Promise((r) => setTimeout(r, 600));
      return res.status(401).send(JSON.stringify({ error: "Maling password." }));
    }
    if (body.check) return res.status(200).send(JSON.stringify({ ok: true, db: store.hasDb() }));

    if (body.config) {
      const clean = sanitize(body.config);
      await store.setJSON(KEY, clean);
      return res.status(200).send(JSON.stringify({ ok: true, db: store.hasDb() }));
    }
    return res.status(400).send(JSON.stringify({ error: "Walang config na ipinadala." }));
  } catch (e) {
    return res.status(500).send(JSON.stringify({ error: String((e && e.message) || e) }));
  }
};
