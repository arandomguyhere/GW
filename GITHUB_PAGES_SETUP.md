# GitHub Pages Setup — Ghostwire

## Files changed
| File | What changed |
|---|---|
| `app.json` | Set `output: "static"`, updated `origin` to your Pages URL |
| `lib/query-client.ts` | No longer crashes when `EXPO_PUBLIC_DOMAIN` is missing |
| `.github/workflows/deploy.yml` | Builds + deploys to Pages on push to `main` |
| `.github/workflows/ci.yml` | Lint + type check on every PR |

---

## Step 1 — Update `app.json` with your actual username

Open `app.json` and replace `USERNAME` with your GitHub username:

```json
"origin": "https://USERNAME.github.io/ghostwire/"
```

If you're using a **custom domain** (e.g. `app.ghostwire.io`) instead:
- Set `"origin": "https://app.ghostwire.io/"`
- Remove the `baseUrl` line entirely
- Add a `CNAME` file to your repo root containing just: `app.ghostwire.io`

---

## Step 2 — Enable GitHub Pages

1. Go to your repo → **Settings → Pages**
2. Under **Source** select **GitHub Actions**
3. Save

---

## Step 3 — Add the API secret

Go to **Settings → Secrets and variables → Actions → New repository secret**:

| Name | Value |
|---|---|
| `EXPO_PUBLIC_DOMAIN` | Your backend URL, e.g. `api.ghostwire.app` or `ghostwire.up.railway.app` |

> The static frontend is hosted on GitHub Pages but still needs a running
> Express server somewhere (Railway, Fly.io, a VPS, etc.) to talk to.
> GitHub Pages only serves the frontend HTML/JS/CSS.

---

## Step 4 — Add CORS for your Pages domain

In `server/index.ts`, add your Pages URL to the allowed origins:

```ts
const allowedOrigins = [
  "https://USERNAME.github.io",
  "https://your-custom-domain.com", // if applicable
  // ... existing Replit origins
];
```

---

## Step 5 — Add your Pages URL to Clerk

In the [Clerk Dashboard](https://dashboard.clerk.com):
- **Configure → Domains** → add `https://USERNAME.github.io`

---

## Step 6 — Push to main

```bash
git add app.json lib/query-client.ts .github/
git commit -m "feat: GitHub Pages deployment"
git push origin main
```

The Actions tab will show the build running. First deploy takes ~3–5 minutes.
Your site will be live at: `https://USERNAME.github.io/ghostwire/`

---

## How routing works on GitHub Pages

GitHub Pages doesn't have a server to handle SPA routing — navigating directly
to `/article/xyz` would return a 404. The workflow copies `index.html` to
`404.html` which makes GitHub Pages serve the app shell for any unknown path,
letting expo-router take over client-side.
