# Ghostwire CI/CD Setup Guide

Two GitHub Actions workflows are included:

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | Every push / PR | Lint, type-check, optional build dry-run |
| `deploy.yml` | Push to `main` or manual | Expo web export → GitHub Pages |

---

## 1. Enable GitHub Pages

1. Go to your repo → **Settings → Pages**
2. Under **Source**, select **GitHub Actions**
3. Save

---

## 2. Set Repository Secrets

Go to **Settings → Secrets and variables → Actions → New repository secret**

| Secret name | Value | Required for |
|---|---|---|
| `EXPO_PUBLIC_DOMAIN` | Your API server URL, e.g. `api.example.com` or `your-app.up.railway.app` | Deploy — **required, build will fail without it** |
| `CLERK_SECRET_KEY` | Your Clerk secret key (`sk_live_...`) | CI build check |

> **Note:** The deployed web app will make API calls to `EXPO_PUBLIC_DOMAIN`.
> You need the Express server running somewhere (Railway, Fly.io, a VPS, etc.) —
> GitHub Pages only hosts the static frontend.

---

## 3. Update `app.json` for GitHub Pages

If your repo is at `https://<your-username>.github.io/<repo-name>/` (not a custom domain),
add a `baseUrl` to your Expo web config so assets resolve correctly:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-router",
        {
          "origin": "https://<your-username>.github.io/<repo-name>/"
        }
      ]
    ],
    "web": {
      "favicon": "./assets/images/favicon.png",
      "baseUrl": "/<repo-name>"
    }
  }
}
```

If you're using a **custom domain** (e.g. `app.example.com`), skip `baseUrl`
and add a `CNAME` file to your repo root containing just your domain.

---

## 4. Fix the `lib/query-client.ts` API URL

The web app needs to know where to send API requests. Make sure `getApiUrl()`
reads from the env var and **does not throw** when it's missing (dev/SSR):

```ts
// lib/query-client.ts
export function getApiUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) return '/'; // fallback for local dev / SSR
  const withProtocol = domain.startsWith('http') ? domain : `https://${domain}`;
  return withProtocol.endsWith('/') ? withProtocol : `${withProtocol}/`;
}
```

> **Important:** The deploy workflow validates that `EXPO_PUBLIC_DOMAIN` is set
> at build time. The fallback here is only for local development — production
> builds will always have the env var baked in.

---

## 5. Workflow Overview

```
Push to any branch / open PR
        │
        ▼
  ┌─────────────┐
  │   ci.yml    │  lint + tsc (always)
  │             │  expo export dry-run (PRs → main or develop)
  └─────────────┘

Push to main (merged PR or direct push)
        │
        ▼
  ┌──────────────┐     ┌─────────────────┐
  │ deploy.yml   │────▶│  GitHub Pages   │
  │ expo export  │     │  (live site)    │
  └──────────────┘     └─────────────────┘
```

---

## 6. Branch Strategy (recommended)

```
main        ← production, auto-deploys to GitHub Pages
develop     ← integration branch, CI runs but no deploy
feature/*   ← individual features, CI runs on PR
```

Use `develop` as your default branch for day-to-day work.
Merge `develop → main` when ready to ship.

---

## Troubleshooting

**`_expo/` folder missing from deployed site**
The `.nojekyll` file is added automatically by the workflow. If assets 404,
check that `.nojekyll` exists at the root of the deployed `dist/` folder.

**API calls fail in production**
Confirm `EXPO_PUBLIC_DOMAIN` is set as a repo secret and that your Express
server has CORS configured to allow your GitHub Pages domain:

```ts
// server/index.ts — add your Pages URL to the allowed origins list
const allowedOrigins = [
  'https://<your-username>.github.io',
  'https://your-custom-domain.com',
  // ... existing origins
];
```

**Clerk auth broken on web**
Add your GitHub Pages URL to the allowed origins in the
[Clerk Dashboard](https://dashboard.clerk.com) under
**Configure → Domains**.

**Build fails with "EXPO_PUBLIC_DOMAIN is not set"**
The deploy workflow now validates this secret before building. Go to
**Settings → Secrets and variables → Actions** and add
`EXPO_PUBLIC_DOMAIN` with your API server URL.

**Build times out (>30 min)**
Expo web export is usually 2–5 minutes. If it's hanging, check the Actions
log for the `Export Expo web build` step — the most common cause is a
misconfigured `EXPO_PUBLIC_DOMAIN` causing the bundler to wait on network
requests.
