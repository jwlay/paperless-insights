import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { useDocuments } from '@/api/queries'
import { useDocumentsFilter } from '@/context/DocumentsFilterContext'
import { buildChartOption } from '@/dashboard/chartOptions'
import {
  DEFAULT_CHARTS,
  getDashboardCharts,
  saveDashboardCharts,
  type ChartConfig,
} from '@/dashboard/chartConfig'
import { AddChartDialog } from '@/dashboard/AddChartDialog'
import { EChart } from '@/dashboard/EChart'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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
  const [useSharedFilter, setUseSharedFilter] = useState(true)
  const [currency, setCurrency] = useState<string | null>(null)
  const [charts, setCharts] = useState<ChartConfig[]>(() => getDashboardCharts())
  const [addOpen, setAddOpen] = useState(false)

  const allDocs = data ?? []
  const docs = useSharedFilter && filteredDocuments ? filteredDocuments : allDocs
  const isFiltered = useSharedFilter && filteredDocuments != null && filteredDocuments.length !== allDocs.length

  const currencies = useMemo(() => {
    const set = new Set<string>()
    for (const doc of docs) if (doc.currency) set.add(doc.currency)
    return [...set].sort()
  }, [docs])

  const activeCurrency = currency ?? currencies[0] ?? null

  function updateCharts(next: ChartConfig[]) {
    setCharts(next)
    saveDashboardCharts(next)
  }

  function removeChart(id: string) {
    updateCharts(charts.filter((c) => c.id !== id))
  }

  function addChart(config: ChartConfig) {
    updateCharts([...charts, config])
  }

  function resetCharts() {
    updateCharts(DEFAULT_CHARTS)
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
        {currencies.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Amounts in</span>
            <Select value={activeCurrency ?? undefined} onValueChange={setCurrency}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {charts.map((config) => {
          const option = buildChartOption(
            config,
            docs,
            activeCurrency,
            (v) => amountFormatter.format(v),
            (v) => countFormatter.format(v),
          )
          const needsCurrency =
            (config.kind === 'grouped' && config.metric === 'total') || config.kind === 'largest-expenses'
          return (
            <ChartCard key={config.id} title={config.title} onRemove={() => removeChart(config.id)}>
              {option ? (
                <EChart
                  option={option}
                  height={config.kind === 'grouped' && config.limit && config.limit > 10 ? 420 : 280}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {needsCurrency ? 'No currency available for this chart yet.' : 'No data yet.'}
                </p>
              )}
            </ChartCard>
          )
        })}
      </div>

      <AddChartDialog open={addOpen} onOpenChange={setAddOpen} onAdd={addChart} />
    </div>
  )
}
