const store = require("./_store");
const { ipHash, isAdmin, body, clean, hasBad, hasLink, newId } = require("./_lib");

const KEY = "jfm:chat", KEEP = 300, GAP = 3;
const parse = (a) => a.map((s) => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean);
const fail = (res, code, error) => res.status(code).json({ error });

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const rows = parse(await store.listRange(KEY, isAdmin(req) ? 200 : 50));
      return res.status(200).json(rows.reverse());
    }
    if (req.method === "POST") {
      const b = body(req);
      const text = clean(b.text, 240), nick = clean(b.nick, 24) || "Bisita";
      const item = text ? { nick, text } : null;
      if (!item) return fail(res, 400, "Walang laman ang mensahe.");
      const all = Object.values(item).join(" ");
      if (hasBad(all)) return fail(res, 400, "Bawal ang ganyang salita.");
      if (hasLink(all)) return fail(res, 400, "Bawal ang links.");
      if (!(await store.rateOk("jfm:rl:chat:" + ipHash(req), GAP))) return fail(res, 429, "Dahan-dahan lang, maghintay ng ilang segundo.");
      item.id = newId(); item.ts = Date.now();
      await store.listPush(KEY, JSON.stringify(item), KEEP);
      return res.status(200).json({ ok: true });
    }
    if (req.method === "DELETE") {
      if (!isAdmin(req)) return fail(res, 401, "Maling password.");
      const id = String(req.query.id || "");
      if (req.query.all === "1") { await store.del(KEY); return res.status(200).json({ ok: true }); }
      if (!/^[a-z0-9]{6,30}$/.test(id)) return fail(res, 400, "Walang id.");
      const raw = (await store.listRange(KEY, KEEP)).find((s) => { try { return JSON.parse(s).id === id; } catch (e) { return false; } });
      if (raw) await store.listRemove(KEY, raw);
      return res.status(200).json({ ok: true });
    }
    return fail(res, 405, "Method not allowed");
  } catch (e) {
    return fail(res, 500, "May problema sa server.");
  }
};
