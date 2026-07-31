# Paperless Insights

A read-only analytics frontend for [Paperless-ngx](https://docs.paperless-ngx.com/).
Paperless remains the single source of truth for all documents — this app only
reads metadata through the Paperless REST API to make tax prep, expense
analysis, and document exploration easier than the stock Paperless UI.

**There is no backend.** Everything runs in your browser: it talks directly to
your Paperless instance's API, and your Paperless URL + API token are stored
only in that browser's `localStorage`. Nothing is sent anywhere else.

## Features

- Full document grid — sort, filter, quick search, column visibility, CSV export
- Automatic detection of the "amount" custom field (by data type, not a
  hardcoded field ID), parsing currency + amount from values like `USD25.11`
- Correspondent/tag/document type/storage path names resolved from IDs
- A Dashboard tab: group documents by correspondent, tag, currency, year,
  month, document type, or storage path, with totals and a bar chart
- Tag pills rendered with their actual Paperless colors
- Preserves original currencies — no forced conversion

## Local development

```bash
npm install
npm run dev
```

## Configuration

The app asks for two things on first load, via the UI — not env vars:

- **Paperless URL** — e.g. `https://paperless.example.com`
- **API token** — from Paperless: Settings → API Tokens

Both are stored in `localStorage` on whichever device/browser you connect
from. There's no server-side config file for these, because there's no
server: redeploying or updating the container doesn't lose them (they live in
your browser), but a different browser or device needs to connect again.

The only deploy-time setting is:

| Env var | Required | What it does |
|---|---|---|
| `PAPERLESS_URL` | No | Pre-fills the URL field on first connect. Convenience only — never treated as a secret, and the API token is **never** configurable this way (see below). |

### Why the token isn't an env var

This app has no backend, so anything used to pre-fill a field ends up in a
plain JS file served to whoever loads the page. That's a reasonable place for
a non-secret default (the URL), but not for an API token — baking it into a
served file would defeat the point of it being an authentication credential.
So the token is always entered once through the UI, per browser.

### Paperless-side requirements

Whatever origin you deploy this app to (e.g.
`https://paperless-insights.example.com`) needs to be allowed to make
cross-origin requests to your Paperless instance:

1. Add the app's origin to Paperless's `PAPERLESS_CORS_ALLOWED_HOSTS`
   (exact match, including scheme and port if non-standard — no wildcards).
2. Restart the Paperless container after changing it.
3. If Paperless sits behind an auth proxy (Authelia, Authentik, tinyauth,
   oauth2-proxy, etc.), make sure `/api/*` bypasses it. Paperless already
   authenticates API requests via the token, and a cookie-based auth gate in
   front of `/api/*` will block this app's cross-origin requests (they carry
   no session cookie) even if you're logged into the gate in the same
   browser.

## Docker deployment

### Quickstart (published image)

Every push to `main` builds and publishes an image to GitHub Container
Registry via `.github/workflows/docker-publish.yml` —
`ghcr.io/jwlay/paperless-insights:latest`. You don't need the source on your
server at all, just the compose file:

```bash
curl -O https://raw.githubusercontent.com/jwlay/paperless-insights/main/docker-compose.yml
curl -O https://raw.githubusercontent.com/jwlay/paperless-insights/main/.env.example
mv .env.example .env   # set PAPERLESS_URL if you want it pre-filled

docker compose pull
docker compose up -d
```

To update later: `docker compose pull && docker compose up -d`.

Tags published by the workflow:

| Tag | When |
|---|---|
| `latest` | Every push to `main` |
| `vX.Y.Z` | Pushing a `vX.Y.Z` git tag (e.g. `git tag v1.0.0 && git push --tags`) |
| `sha-<commit>` | Every build, for pinning to an exact commit |

If pulling fails with a permission error the first time, the package may need
its visibility set to public: repo → **Packages** → `paperless-insights` →
Package settings → Change visibility. This is usually only needed once.

### Building locally instead

If you're developing against the Dockerfile itself rather than pulling the
published image:

```bash
cp .env.example .env
docker compose build   # uses the `build: .` line — see docker-compose.yml
docker compose up -d
```

Either way, the image builds a static production bundle and serves it with
nginx (`Dockerfile`, `docker/nginx.conf`). `docker/entrypoint.sh` regenerates
`config.js` from `PAPERLESS_URL` at container start, so changing that env var
only needs a container restart — not a rebuild or a re-pull.

`docker-compose.yml` maps port `8080` by default. If you sit services behind
a reverse proxy, `docker-compose.yml` includes a commented-out example for
Traefik with a forward-auth middleware — swap in whatever proxy and auth
setup (or none) you actually use; a plain `ports:` mapping with your own
reverse proxy config in front works just as well.

## Project layout

```
src/
  api/          Paperless REST client + pagination + TanStack Query hooks
  models/       Normalized document model + custom-field amount parsing glue
  parsing/      Amount/currency parsing (auto-detects the monetary custom field)
  components/   Shared UI (connection screen, grid, column menu)
  grid/         AG Grid column definitions and cell renderers
  dashboard/    Client-side grouping/aggregation + bar chart
  pages/        Top-level pages (Dashboard)
  lib/          Local storage config, shadcn utils
```

## Tech stack

React, TypeScript, Vite, AG Grid Community, Tailwind CSS, shadcn/ui, TanStack
Query. No backend, no build-time coupling to any specific Paperless instance.

## Limitations

- AG Grid Community doesn't include row grouping, pivoting, or Integrated
  Charts (all Enterprise-only) — the Dashboard tab is a hand-built
  alternative computed client-side, not a native AG Grid feature.
- No cross-currency conversion; totals are always shown per original
  currency.
