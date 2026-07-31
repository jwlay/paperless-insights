import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { getRuntimeDefaultUrl, normalizePaperlessUrl, setPaperlessConfig } from '@/lib/paperless-config'

export function ConnectionSetup({ onConnected }: { onConnected: () => void }) {
  const [baseUrl, setBaseUrl] = useState(() => getRuntimeDefaultUrl())
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!baseUrl.trim() || !token.trim()) {
      setError('Please enter both the Paperless URL and API token.')
      return
    }

    let url: string
    try {
      url = normalizePaperlessUrl(baseUrl)
    } catch {
      setError(
        "That doesn't look like a valid URL. Include the protocol, e.g. https://paperless.example.com",
      )
      return
    }

    setChecking(true)
    try {
      const res = await fetch(`${url}/api/documents/?page_size=1`, {
        headers: { Authorization: `Token ${token.trim()}` },
      })
      if (!res.ok) {
        setError(
          res.status === 401 || res.status === 403
            ? 'Authentication failed. Check your API token.'
            : `Could not reach Paperless (HTTP ${res.status}).`,
        )
        return
      }
      const contentType = res.headers.get('content-type') ?? ''
      if (!contentType.includes('application/json')) {
        setError(
          `That URL responded, but not with JSON from Paperless (got "${contentType || 'no content type'}"). Double-check it points directly at your Paperless server.`,
        )
        return
      }
    } catch (cause) {
      console.error(`Connection test to ${url} failed:`, cause)
      setError(
        `Could not connect (${cause instanceof Error ? cause.message : String(cause)}). Check the URL and make sure Paperless allows requests from this origin (CORS) — see the browser console for details.`,
      )
      return
    } finally {
      setChecking(false)
    }

    setPaperlessConfig({ baseUrl: url, token: token.trim() })
    onConnected()
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Connect to Paperless</CardTitle>
          <CardDescription>
            Paperless Insights runs entirely in your browser. Your URL and API token are stored
            only in local storage on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="baseUrl">Paperless URL</Label>
              <Input
                id="baseUrl"
                placeholder="https://paperless.example.com"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                autoComplete="url"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="token">API Token</Label>
              <Input
                id="token"
                type="password"
                placeholder="Your Paperless API token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="off"
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full" disabled={checking}>
              {checking ? 'Connecting…' : 'Connect'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
