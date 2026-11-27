# 買取日本 (Kaitorinihon) — project notes for Claude

Buyback and sales website for 株式会社ROYAL JAPAN. Live at https://kaitorinihon.jp/ . No passwords, tokens or keys are stored in this repo; the owner signs in to every account themself.

## Layout
- `uridoki.html` — the whole single-page site (HTML, CSS, JS). Source of truth.
- `work/site.json` — all site content (texts, products, news, campaigns, stores, FAQ). Served as `/data/site.json`.
- `work/i18n/` — translations for en, zh-hant, ko, bn, si, ne. `keys.json` is append-only; `tr/<code>.tsv` lines are `index|first 2 chars|translation`; digits become `{0}`,`{1}`… Validate with `node work/i18n-build.js <root> en zh-hant ko bn si ne`.
- `work/seo-build.js` — home page head, structured data, server-HTML blocks (today's prices, footer facts), robots.txt, 404, and `data/catalog.json` (run by the build). `work/catalog-build.js` makes the catalogue (models, slugs, stores, FAQ, texts).
- `work/_worker.js` — Cloudflare Pages worker that makes, on request and cached for minutes: the home page's live prices, `/kaitori/`, `/kaitori/<category>/`, `/kaitori/<category>/<model>/`, `/shops/…`, `/company/`, `/faq/`, `/contact/`, `/terms/`, `/privacy/`, `/cookie/`, `/kaitori/flow/`, `/kaitori/notes/`, `/shop/…` and `/sitemap.xml`. Prices come from Supabase `web_buyback_prices` when it has rows, else the relay feed. Stock comes only from `web_products_for_sale`. Paths the worker serves are listed in `_routes.json` (written by `build-site.ps1`).
- `work/make-webp.js` — makes `img/*.webp` and `img/meta.json` (needs the sharp package; run only when images change).
- `work/build-site.ps1` — builds `site/` and `kaitori-site.zip`.
- `relay/*.gs` — Google Apps Script relay (orders, Telegram, emails, prices). `relay/SETUP.md` explains it.
- `site/` — build output (committed). `kaitori-site.zip` is not committed.

## Build and preview
```
powershell -NoProfile -ExecutionPolicy Bypass -File work/build-site.ps1 -Root "<absolute path of this folder>"
```
Local preview: `.claude/launch.json`, server name `kaitori` (port 8766). The preview serves `uridoki.html` and `work/site.json`; translations and the `/shop` worker are not served locally.

## Deploying
- **Site → Cloudflare Pages** (project `kaitorinihon`, Production): automatic. After rebuilding, commit `site/` and push to `main`; the GitHub Action `.github/workflows/deploy.yml` uploads `site/` (it needs the repository secret `CLOUDFLARE_API_TOKEN`, created by the owner). Check the Actions tab and https://kaitorinihon.jp/ afterwards. Manual fallback: dash.cloudflare.com → Workers & Pages → kaitorinihon → Create deployment → upload `kaitori-site.zip` (includes `_worker.js` and `_routes.json`) → Save and deploy.
- **Relay → Apps Script** (project 買取日本 受付リレー): edit `Code.gs`, `Untitled.gs` (= Bot.gs), `Member.gs`, `Prices.gs`; Deploy → Manage deployments → pencil → Version: New version → Deploy. Same web-app URL stays. Keep `relay/*.gs` in sync with what is deployed.
- **Claude artifact** `36b4ef68-4bfc-46d3-b29d-724b03867a41` (public, https://claude.ai/artifact/7kpFiP6j2thVvCtGQrXHH2): published from files: `index.html` (= uridoki.html), `data/site.json`, `data/i18n/*.json`. Forms, stock and analytics cannot work inside the artifact sandbox.
- GitHub: `kaitorinihon244/kaitorinihon`, branch `main`.

## Integrations
- Supabase `https://vqfreyiveytlolsaaypy.supabase.co`, publishable key `sb_publishable_yqJcfi5QUeOzV7f8eucjFA_A9cVHAvH` (public; header `apikey`, not Bearer). Views `web_products_for_sale`, `web_buyback_prices`, `web_shops`; RPC `submit_buyback_request`. Stock rule: model+storage in `web_products_for_sale` → 在庫あり with its `selling_price`; otherwise 7日以内にお届け with the site price. Never show 在庫なし. Hide prices above ¥500,000 or below ¥1,000.
- Google Analytics 4 `G-GJCHT41QT0`, loaded only after the visitor accepts cookies. Search Console and Bing Webmaster are set up (Bing tag in the home page head).
- Relay Script properties (Telegram, NOTIFY_EMAIL, ID_PHOTO_REQUIRED, REVIEW_URL …) live only in Apps Script project settings.

## Business facts used on the site
- Hours 10:00–17:00 every day. Licence 東京都公安委員会 第305501407894号.
- Stores: 池袋店, 新宿1号店, 新大久保店 (was 新宿2号店), 鶴見店. Phone numbers and Google Maps links are in `work/site.json` (`stores`). Google ratings per store are stored there (`rating`, `reviews`).
- Repair booking was removed on purpose (the owner has another site for it). The 高校生限定キャンペーン news post must stay.

## Working rules
- The user signs in to Cloudflare, Google and other accounts in their own browser. Never ask for or enter passwords or tokens, and never paste them into chat.
- Do not submit real buyback or order forms for testing without asking: they send real email, Telegram and sheet rows.
- After changing `uridoki.html` or `work/site.json`, rebuild, commit, push, then upload `kaitori-site.zip`. Keep translations in step when Japanese text changes.
- Public data files contain no secrets. Do not add any.
