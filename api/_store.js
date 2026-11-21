// Maliit na storage helper: Upstash Redis / Vercel KV sa REST (walang dependency).
// Kapag walang naka-connect na database, gumagamit ng memory (pansamantala lang, nawawala sa cold start).
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

const mem = (globalThis.__jfmMem = globalThis.__jfmMem || { kv: new Map(), z: new Map() });

function hasDb() { return !!(URL_ && TOKEN); }

async function pipeline(cmds) {
  const r = await fetch(URL_.replace(/\/$/, "") + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error("Storage error " + r.status);
  const out = await r.json();
  return out.map((x) => {
    if (x && x.error) throw new Error(x.error);
    return x.result;
  });
}

async function getJSON(key) {
  if (!hasDb()) return mem.kv.get(key) || null;
  const [v] = await pipeline([["GET", key]]);
  if (!v) return null;
  try { return JSON.parse(v); } catch (e) { return null; }
}

async function setJSON(key, obj) {
  if (!hasDb()) { mem.kv.set(key, obj); return; }
  await pipeline([["SET", key, JSON.stringify(obj)]]);
}

// Listeners: sorted set (score = oras ng huling ping)
async function listeners(key, { id, leave, ttlMs }) {
  const now = Date.now();
  const cutoff = now - ttlMs;
  if (!hasDb()) {
    let z = mem.z.get(key); if (!z) { z = new Map(); mem.z.set(key, z); }
    for (const [k, t] of z) if (t < cutoff) z.delete(k);
    if (id && leave) z.delete(id); else if (id) z.set(id, now);
    return z.size;
  }
  const cmds = [["ZREMRANGEBYSCORE", key, "-inf", String(cutoff)]];
  if (id && leave) cmds.push(["ZREM", key, id]);
  else if (id) cmds.push(["ZADD", key, String(now), id], ["EXPIRE", key, "600"]);
  cmds.push(["ZCARD", key]);
  const res = await pipeline(cmds);
  return Number(res[res.length - 1]) || 0;
}


// ---- Chat/Request helpers (listahan na may limit + rate limit) ----
const rl = (globalThis.__jfmRl = globalThis.__jfmRl || new Map());

// True kung pwedeng magpatuloy; False kung masyadong mabilis (isang beses kada `secs`)
async function rateOk(key, secs) {
  if (!hasDb()) {
    const now = Date.now();
    if ((rl.get(key) || 0) > now) return false;
    rl.set(key, now + secs * 1000);
    return true;
  }
  const [r] = await pipeline([["SET", key, "1", "NX", "EX", String(secs)]]);
  return r === "OK";
}
async function listPush(key, str, max) {
  if (!hasDb()) { const a = mem.kv.get(key) || []; a.unshift(str); mem.kv.set(key, a.slice(0, max)); return; }
  await pipeline([["LPUSH", key, str], ["LTRIM", key, "0", String(max - 1)]]);
}
async function listRange(key, n) {
  if (!hasDb()) return (mem.kv.get(key) || []).slice(0, n);
  const [r] = await pipeline([["LRANGE", key, "0", String(n - 1)]]);
  return r || [];
}
async function listRemove(key, str) {
  if (!hasDb()) { mem.kv.set(key, (mem.kv.get(key) || []).filter((x) => x !== str)); return; }
  await pipeline([["LREM", key, "0", str]]);
}
async function del(key) {
  if (!hasDb()) { mem.kv.delete(key); return; }
  await pipeline([["DEL", key]]);
}

module.exports = { hasDb, getJSON, setJSON, listeners, rateOk, listPush, listRange, listRemove, del };
