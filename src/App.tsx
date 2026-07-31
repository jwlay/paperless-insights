import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectionSetup } from '@/components/ConnectionSetup'
import { DocumentsGrid } from '@/components/DocumentsGrid'
import { DashboardPage } from '@/pages/DashboardPage'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { clearPaperlessConfig, getPaperlessConfig } from '@/lib/paperless-config'

const queryClient = new QueryClient()

function App() {
  const [connected, setConnected] = useState(() => getPaperlessConfig() !== null)

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
      <Tabs defaultValue="documents" className="h-screen gap-0">
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
        <TabsContent value="documents" className="min-h-0">
          <DocumentsGrid />
        </TabsContent>
        <TabsContent value="dashboard" className="min-h-0">
          <DashboardPage />
        </TabsContent>
      </Tabs>
    </QueryClientProvider>
  )
}

export default App
