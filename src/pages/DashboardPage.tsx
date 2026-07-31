import { useState } from 'react'
import { X } from 'lucide-react'
import { useDocuments } from '@/api/queries'
import { useDocumentsFilter } from '@/context/DocumentsFilterContext'
import { buildChartOption } from '@/dashboard/chartOptions'
import { getDefaultCharts, getSavedCharts, saveDashboardCharts, type ChartConfig } from '@/dashboard/chartConfig'
import { getPalette } from '@/dashboard/colors'
import { AddChartDialog } from '@/dashboard/AddChartDialog'
import { EChart } from '@/dashboard/EChart'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useIsDarkMode } from '@/lib/theme'

const amountFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const countFormatter = new Intl.NumberFormat(undefined)

function ChartCard({
  title,
  onRemove,
  children,
}: {
  title: string
  onRemove: () => void
  children: React.ReactNode
}) {
  return (
    <div className="group relative rounded-lg border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
        <button
          type="button"
          aria-label={`Remove ${title} chart`}
          onClick={onRemove}
          className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {children}
    </div>
  )
}

export function DashboardPage() {
  const { data, isLoading, error } = useDocuments()
  const { filteredDocuments } = useDocumentsFilter()
  const palette = getPalette(useIsDarkMode())
  const [useSharedFilter, setUseSharedFilter] = useState(true)
  const [customCharts, setCustomCharts] = useState<ChartConfig[] | null>(() => getSavedCharts())
  const [addOpen, setAddOpen] = useState(false)

  const allDocs = data?.documents ?? []
  const customFieldDefs = data?.customFieldDefs ?? []
  const docs = useSharedFilter && filteredDocuments ? filteredDocuments : allDocs
  const isFiltered =
    useSharedFilter && filteredDocuments != null && filteredDocuments.length !== allDocs.length

  const charts = customCharts ?? getDefaultCharts(customFieldDefs, docs)

  function persistCharts(next: ChartConfig[]) {
    setCustomCharts(next)
    saveDashboardCharts(next)
  }

  function removeChart(id: string) {
    persistCharts(charts.filter((c) => c.id !== id))
  }

  function addChart(config: ChartConfig) {
    persistCharts([...charts, config])
  }

  function resetCharts() {
    setCustomCharts(null)
    saveDashboardCharts(null)
  }

  if (error) {
    return <div className="p-6 text-destructive">Failed to load documents: {error.message}</div>
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      {isFiltered && (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Showing a filtered view from Documents — {countFormatter.format(docs.length)} of{' '}
              {countFormatter.format(allDocs.length)} documents.
            </span>
            <Button variant="outline" size="sm" onClick={() => setUseSharedFilter(false)}>
              Show all documents instead
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {!useSharedFilter && (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>Showing all documents, ignoring the Documents grid's current filters.</span>
            <Button variant="outline" size="sm" onClick={() => setUseSharedFilter(true)}>
              Use filtered view again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {isLoading && <span className="text-sm text-muted-foreground">Loading…</span>}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={resetCharts}>
            Reset to defaults
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            Add chart
          </Button>
        </div>
      </div>

      {charts.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No charts yet — add one, or reset to the defaults.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {charts.map((config) => {
          const option = buildChartOption(
            config,
            docs,
            customFieldDefs,
            (v) => amountFormatter.format(v),
            (v) => countFormatter.format(v),
            palette,
          )
          return (
            <ChartCard key={config.id} title={config.title} onRemove={() => removeChart(config.id)}>
              {option ? (
                <EChart option={option} />
              ) : (
                <p className="text-sm text-muted-foreground">No data for this chart yet.</p>
              )}
            </ChartCard>
          )
        })}
      </div>

      <AddChartDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdd={addChart}
        customFieldDefs={customFieldDefs}
        docs={docs}
      />
    </div>
  )
}
