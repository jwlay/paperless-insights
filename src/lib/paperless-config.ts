export interface PaperlessConfig {
  baseUrl: string
  token: string
}

declare global {
  interface Window {
    // Injected by docker/entrypoint.sh at container startup (see public/config.js
    // for the local-dev placeholder). URL only — never the token, see README.
    __PAPERLESS_INSIGHTS_CONFIG__?: { defaultUrl?: string }
  }
}

const STORAGE_KEY = 'paperless-insights:config'

export function getRuntimeDefaultUrl(): string {
  return window.__PAPERLESS_INSIGHTS_CONFIG__?.defaultUrl?.trim() ?? ''
}

// Accepts input with or without a scheme (e.g. "paperless.example.com") and
// throws if the result still isn't a valid absolute URL. Without this, a
// scheme-less URL silently becomes a relative fetch path that resolves
// against this app's own origin instead of the Paperless server.
export function normalizePaperlessUrl(input: string): string {
  const trimmed = input.trim()
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  return new URL(withScheme).origin
}

export function getPaperlessConfig(): PaperlessConfig | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PaperlessConfig
  } catch {
    return null
  }
}

export function setPaperlessConfig(config: PaperlessConfig) {
  const normalized: PaperlessConfig = {
    baseUrl: normalizePaperlessUrl(config.baseUrl),
    token: config.token.trim(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
}

export function clearPaperlessConfig() {
  localStorage.removeItem(STORAGE_KEY)
}
