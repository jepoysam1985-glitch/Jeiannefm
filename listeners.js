// /api/listeners?id=XXXX        -> mag-ping (nakikinig)
// /api/listeners?leave=1&id=XXXX -> umalis
// /api/listeners                -> bilang lang
const store = require("./_store");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  try {
    const q = req.query || {};
    const id = typeof q.id === "string" && /^[A-Za-z0-9]{6,40}$/.test(q.id) ? q.id : "";
    const count = await store.listeners("jfm:listeners", { id, leave: !!q.leave, ttlMs: 75000 });
    res.status(200).send(JSON.stringify({ count }));
  } catch (e) {
    res.status(200).send(JSON.stringify({}));
  }
};
