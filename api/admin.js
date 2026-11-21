// POST /api/admin  { password } -> { token }   (may lockout kapag paulit-ulit na mali)
// GET  /api/admin  (Authorization: Bearer <token>) -> 200 kung valid pa ang token
const crypto = require("crypto");
const store = require("./_store");
const { ipHash, isAdmin, body, makeToken } = require("./_lib");

const MAX_TRIES = 5, LOCK_MS = 15 * 60 * 1000;
const sha = (s) => crypto.createHash("sha256").update(String(s)).digest();
const send = (res, code, obj) => res.status(code).json(obj);

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (!process.env.ADMIN_PASSWORD) return send(res, 500, { error: "Walang ADMIN_PASSWORD sa Vercel Environment Variables." });

    if (req.method === "GET") return isAdmin(req) ? send(res, 200, { ok: true }) : send(res, 401, { error: "Mag-login ulit." });
    if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });

    const key = "jfm:lock:" + ipHash(req);
    const st = (await store.getJSON(key)) || { n: 0, until: 0 };
    if (st.until && st.until > Date.now()) {
      const m = Math.ceil((st.until - Date.now()) / 60000);
      return send(res, 429, { error: "Masyadong maraming maling subok. Subukan ulit pagkalipas ng " + m + " minuto." });
    }

    const p = body(req).password;
    const ok = typeof p === "string" && p.length > 0 && crypto.timingSafeEqual(sha(p), sha(process.env.ADMIN_PASSWORD));
    if (!ok) {
      st.n = (st.n || 0) + 1;
      if (st.n >= MAX_TRIES) { st.n = 0; st.until = Date.now() + LOCK_MS; } else st.until = 0;
      await store.setJSON(key, st);
      await new Promise((r) => setTimeout(r, 600));
      return send(res, 401, { error: "Maling password." });
    }
    if (st.n || st.until) await store.setJSON(key, { n: 0, until: 0 });
    return send(res, 200, { token: makeToken(), db: store.hasDb() });
  } catch (e) {
    return send(res, 500, { error: "May problema sa server." });
  }
};
