# 🚀 Instaflow SEO Suite - Free Cloudflare Worker Proxy (Tier 2)

This directory contains everything needed to deploy your **100% Free SEO Proxy Worker** to Cloudflare Workers (Free Plan gives you 100,000 requests/day at zero cost).

---

## 📁 Files in this Folder

- `index.js` - Complete standalone worker script with built-in SSRF protection, redirect tracking, timing metrics, and endpoints:
  - `GET /fetch?url=https://example.com`
  - `GET /robots?url=https://example.com`
  - `GET /sitemap?url=https://example.com`
  - `GET /suggest?q=query`
  - `GET /health`
- `wrangler.toml` - Cloudflare Workers deployment config.
- `package.json` - NPM scripts for local development and deployment.

---

## ⚡ Method 1: Deploy with CLI (Fastest - 1 minute)

1. Open your terminal in this directory:
   ```bash
   cd cloudflare-worker-seo
   ```

2. Log in to Cloudflare (free):
   ```bash
   npx wrangler login
   ```

3. Deploy:
   ```bash
   npx wrangler deploy
   ```

4. You will get a URL like:
   `https://instaflow-seo-proxy.<your-subdomain>.workers.dev`

5. Copy that URL and paste it into **Instaflow SEO Suite > Settings > Worker Proxy URL**.

---

## 🌐 Method 2: Deploy via Cloudflare Web Dashboard (No CLI needed)

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com/) and create a free account or log in.
2. In the left sidebar, click **Workers & Pages** > **Create application** > **Create Worker**.
3. Name your worker (e.g. `instaflow-seo-proxy`) and click **Deploy**.
4. Click **Edit code**.
5. Copy the entire content of [`index.js`](file:///Volumes/projects/instaflow/cloudflare-worker-seo/index.js) and paste it into the editor (replacing all default code).
6. Click **Save and Deploy**.
7. Copy your worker's `.workers.dev` URL and paste it into **Instaflow SEO Suite > Settings**.

---

## 🔒 Security & Limits Built-in

- **SSRF Guard**: Blocks private IPs (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), localhost (`127.0.0.1`), link-local (`169.254.0.0/16`), and metadata endpoints (`169.254.169.254`).
- **Response Limit**: Max 3MB payload safeguard.
- **Timeout**: 10s fetch timeout.
- **Redirects**: Tracks up to 5 redirects and exposes the full redirect chain.
- **CORS Support**: Automatic CORS handling for browser fetch requests.
