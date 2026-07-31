# Paperless Insights

A read-only analytics frontend for [Paperless-ngx](https://docs.paperless-ngx.com/).
Paperless remains the single source of truth for all documents — this app only
reads metadata through the Paperless REST API to make tax prep, expense
analysis, and document exploration easier than the stock Paperless UI.

**There is no backend.** Everything runs in your browser: it talks directly to
your Paperless instance's API, and your Paperless URL + API token are stored
only in that browser's `localStorage`. Nothing is sent anywhere else.

## Features

- Full document grid — sort, filter, quick search, column visibility, CSV
  export, a manual refresh button (no full page reload needed after editing
  something in Paperless)
- Built-in quick views (all documents, this year, last 30 days, missing
  amount, missing correspondent) plus **saved views**: capture the grid's
  current column filters, sort order, and search as a named, reusable view
  (e.g. "Tax receipts 2026", "Software subscriptions") — stored locally,
  no server round-trip
- Automatic detection of the "amount" custom field (by data type, not a
  hardcoded field ID), parsing currency + amount from values like `USD25.11`
  (see [Custom field setup](#custom-field-setup-required-for-amounts) below)
- Correspondent/tag/document type/storage path names resolved from IDs
- A Dashboard tab (charts via [Apache ECharts](https://echarts.apache.org/))
  that **reuses whatever filters are active in the Documents grid** — same
  saved view, same search, same column filters — with a banner making it
  explicit when you're looking at a filtered subset rather than everything,
  and a one-click toggle back to all documents
- Dashboard charts are fully customizable: add a chart by picking a
  dimension (correspondent/tag/document type/storage path/currency/year/
  month), a metric (total amount or document count), and a visual (bar/
  line/pie), or remove any chart — your layout persists locally. Ships with
  8 preconfigured: monthly spending, spending by correspondent, spending by
  tag, currency distribution, top 20 vendors, largest expenses, documents
  added over time, and missing metadata
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

### Custom field setup (required for amounts)

Paperless has no built-in concept of a document "amount" — this app reads it
from a **custom field you create yourself** in Paperless:

1. In Paperless: Settings → Custom Fields → Add Field
2. Set its **type to "Monetary"** (the name doesn't matter — call it "Total
   Amount", "Invoice Amount", whatever you like)
3. Populate it on your documents with the amount, e.g. `25.11 USD` — Paperless
   stores this as a currency + number pair (`USD25.11`), which is what this
   app parses. You can fill it in manually per document, or automate it with
   a Paperless workflow/consumption template if you already extract amounts
   some other way.

The app detects this field **by its type** (`monetary`), not by name or a
hardcoded ID, so renaming it is safe. If you create more than one monetary
custom field, only the first one returned by the API is used. Documents with
no value in this field show up in the "Missing amount" view rather than
being silently dropped.

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
  components/   Shared UI (connection screen, grid, column/views menus)
  grid/         AG Grid column definitions, cell renderers, saved-views storage
  dashboard/    Grouping/aggregation, chart config + option builders, ECharts wrapper
  pages/        Top-level pages (Dashboard)
  context/      Cross-page state (Documents grid's active filter, shared with Dashboard)
  lib/          Local storage config, shadcn utils
```

## Tech stack

React, TypeScript, Vite, AG Grid Community, Tailwind CSS, shadcn/ui, TanStack
Query, Apache ECharts. No backend, no build-time coupling to any specific
Paperless instance.

## Limitations

- AG Grid Community doesn't include row grouping, pivoting, or Integrated
  Charts (all Enterprise-only) — the Dashboard tab's grouping/charts are
  computed client-side in plain TypeScript and rendered with ECharts, not
  native AG Grid features.
- No cross-currency conversion; totals are always shown per original
  currency, and any chart or total scoped to "amounts in <currency>" only
  counts documents in that currency.
- Saved views only capture column filters, sort, and quick-search text (what
  AG Grid Community exposes) — not a full custom query builder.
