import { lazy, Suspense, useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectionSetup } from '@/components/ConnectionSetup'
import { DocumentsGrid } from '@/components/DocumentsGrid'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { clearPaperlessConfig, getPaperlessConfig } from '@/lib/paperless-config'
import { useIsDarkMode } from '@/lib/theme'
import { DocumentsFilterProvider } from '@/context/DocumentsFilterContext'

// ECharts is a large dependency — only load it when the Dashboard tab is actually opened.
const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)

const queryClient = new QueryClient()

function App() {
  const [connected, setConnected] = useState(() => getPaperlessConfig() !== null)
  const [dashboardVisited, setDashboardVisited] = useState(false)
  const isDark = useIsDarkMode()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

  if (!connected) {
    return <ConnectionSetup onConnected={() => setConnected(true)} />
  }

  function disconnect() {
    clearPaperlessConfig()
    queryClient.clear()
    setConnected(false)
  }

  return (
    <QueryClientProvider client={queryClient}>
      <DocumentsFilterProvider>
        <Tabs
          defaultValue="documents"
          className="h-screen gap-0"
          onValueChange={(value) => {
            if (value === 'dashboard') setDashboardVisited(true)
          }}
        >
          <header className="flex items-center justify-between border-b px-4 py-3">
            <span className="text-lg font-semibold">Paperless Insights</span>
            <TabsList>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            </TabsList>
            <Button variant="ghost" size="sm" onClick={disconnect}>
              Disconnect
            </Button>
          </header>
          {/* forceMount + data-state styling, not conditional rendering — so
              switching tabs doesn't unmount DocumentsGrid, which would throw
              away AG Grid's own filter/sort state (not tracked in our React
              state, so it can't be restored on remount otherwise). */}
          <TabsContent value="documents" forceMount className="min-h-0 data-[state=inactive]:hidden">
            <DocumentsGrid />
          </TabsContent>
          <TabsContent
            value="dashboard"
            forceMount={dashboardVisited ? true : undefined}
            className="min-h-0 data-[state=inactive]:hidden"
          >
            <Suspense
              fallback={<div className="p-6 text-sm text-muted-foreground">Loading dashboard…</div>}
            >
              <DashboardPage />
            </Suspense>
          </TabsContent>
        </Tabs>
      </DocumentsFilterProvider>
    </QueryClientProvider>
  )
}

export default App
