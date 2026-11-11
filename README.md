# JEIANNE FM — Deployment Package

Laman:

```
index.html              ang website (radio player, chat, request)
admin.html              admin panel (https://jeiannefm.vercel.app/admin)
api/admin.js            login ng admin (may lockout)
api/chat.js, requests.js  shared chat at request box
api/config.js           settings ng admin (logo, banners, links, ad) — GET/POST
api/listeners.js        live listener count
api/_store.js           storage helper (Upstash Redis / Vercel KV)
manifest.webmanifest    para ma-"Add to Home Screen" bilang app
icons/                  192, 512, maskable, apple-touch, favicon
favicon.ico, og-image.jpg   (og-image = preview kapag shinare sa Facebook)
vercel.json             headers, caching
robots.txt, sitemap.xml, package.json, .env.example
```

## Paano i-deploy (Vercel)

1. I-upload ang buong folder sa GitHub (o i-drag ang folder sa vercel.com/new).
2. Sa **Vercel > Project > Settings > Environment Variables**, idagdag:
   - `ADMIN_PASSWORD` = ang password mo sa admin panel
3. **Para makita ng LAHAT ng listeners ang admin changes at ang listener count**, mag-connect ng database:
   Vercel > Project > **Storage** > Create > **Upstash Redis** (libre ang free plan) > Connect to project.
   Awtomatikong nalalagay ang `KV_REST_API_URL` at `KV_REST_API_TOKEN`.
4. I-**Redeploy** (kailangan para pumasok ang bagong environment variables).
5. Buksan ang `https://jeiannefm.vercel.app/admin`, mag-login gamit ang `ADMIN_PASSWORD`.

Kung walang database: gagana pa rin ang site, pero pansamantala lang ang naka-save na settings at listener count
(nawawala kapag nag-restart ang server). Kaya kailangan ang Upstash para sa tuloy-tuloy na gamit.

## Kung ibang domain ang gamit mo

Palitan ang `https://jeiannefm.vercel.app` sa: `index.html` (canonical, og:url, og:image), `robots.txt`, `sitemap.xml`.

## Mga tala

- Naka-off sa `index.html` ang service worker (sinadya, para hindi harangan ang audio stream), kaya hindi offline ang app.
  Gumagana pa rin ang "Add to Home Screen" dahil sa manifest.
- Ang tanging binago ko sa `index.html` ay dalawang `<link>` sa `<head>` (manifest at favicon.ico).
- Para magpalit ng stream URL, gamitin ang admin panel (o ang `streamUrl` sa `index.html`).
