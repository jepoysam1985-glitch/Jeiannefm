const crypto = require("crypto");

function ipHash(req) {
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || (req.socket && req.socket.remoteAddress) || "";
  return crypto.createHash("sha256").update(ip + (process.env.IP_SALT || "jfm")).digest("hex").slice(0, 24);
}
const sha = (s) => crypto.createHash("sha256").update(String(s)).digest();
const secret = () => sha("jfm-token:" + (process.env.ADMIN_PASSWORD || "") + ":" + (process.env.IP_SALT || "jfm"));
const sign = (s) => crypto.createHmac("sha256", secret()).update(s).digest("base64url");
// Token ng admin: "<pag-expire sa base36>.<pirma>" (walang itinatago sa server)
function makeToken(ttlMs) {
  const exp = (Date.now() + (ttlMs || 12 * 3600 * 1000)).toString(36);
  return exp + "." + sign(exp);
}
function tokenOk(t) {
  if (!process.env.ADMIN_PASSWORD || typeof t !== "string") return false;
  const [exp, sig] = t.split(".");
  if (!exp || !sig) return false;
  const a = Buffer.from(sig), b = Buffer.from(sign(exp));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  return parseInt(exp, 36) > Date.now();
}
function isAdmin(req) {
  const a = process.env.ADMIN_PASSWORD || "";
  if (!a) return false;
  const auth = String(req.headers["authorization"] || "");
  if (/^Bearer\s+/i.test(auth) && tokenOk(auth.replace(/^Bearer\s+/i, "").trim())) return true;
  const p = req.headers["x-admin-password"] || "";
  return !!p && crypto.timingSafeEqual(sha(p), sha(a));
}
function body(req) {
  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  return b && typeof b === "object" ? b : {};
}
function clean(s, max) {
  return String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
// Idagdag/bawasan ang listahan ayon sa gusto mo (buong salita ang tinitingnan)
const BAD = new Set(["putangina","tangina","tanginamo","puta","gago","gaga","bobo","tarantado","ulol","pakyu","fuck","fck","shit","bitch","asshole","pokpok","kantot","iyot","tite","puke","pepe"]);
function hasBad(s) {
  const t = s.toLowerCase().replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/@/g, "a").replace(/\$/g, "s");
  return t.split(/[^a-zñ]+/).some((w) => BAD.has(w));
}
const hasLink = (s) => /https?:\/\/|www\.|\.(com|net|ph|ly|xyz)\b/i.test(s);
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

module.exports = { ipHash, isAdmin, makeToken, tokenOk, body, clean, hasBad, hasLink, newId };
