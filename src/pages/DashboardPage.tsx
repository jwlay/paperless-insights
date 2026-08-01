import { useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Pencil, X } from 'lucide-react'
import { useDocuments } from '@/api/queries'
import { useDocumentsFilter } from '@/context/DocumentsFilterContext'
import { buildChartOption } from '@/dashboard/chartOptions'
import {
  computeDuplicateDocuments,
  computeRecentDocuments,
} from '@/dashboard/aggregate'
import {
  getDefaultCharts,
  getSavedCharts,
  saveDashboardCharts,
  type ChartConfig,
} from '@/dashboard/chartConfig'
import { getPalette } from '@/dashboard/colors'
import { AddChartDialog } from '@/dashboard/AddChartDialog'
import { EChart } from '@/dashboard/EChart'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useIsDarkMode } from '@/lib/theme'
import { cn } from '@/lib/utils'
import type { NormalizedDocument } from '@/models/document'

const amountFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const countFormatter = new Intl.NumberFormat(undefined)

const INSIGHTS_VISIBLE_KEY = 'paperless-insights:show-insights'

function isWideChart(config: ChartConfig): boolean {
  return config.kind === 'activity-calendar' || config.kind === 'stacked-bar'
}

function ChartCard({
  title,
  wide,
  onEdit,
  onMoveUp,
  onMoveDown,
  onRemove,
  children,
}: {
  title: string
  wide?: boolean
  onEdit: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onRemove: () => void
  children: React.ReactNode
}) {
  return (
    <div className={cn('group relative rounded-lg border bg-card p-4', wide && 'lg:col-span-2')}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {onMoveUp && (
            <button
              type="button"
              aria-label={`Move ${title} chart up`}
              onClick={onMoveUp}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
          )}
          {onMoveDown && (
            <button
              type="button"
              aria-label={`Move ${title} chart down`}
              onClick={onMoveDown}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            aria-label={`Edit ${title} chart`}
            onClick={onEdit}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label={`Remove ${title} chart`}
            onClick={onRemove}
            className="rounded p-0.5 text-muted-foreground hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {children}
    </div>
  )
}

function DocumentListCard({
  title,
  documents,
  renderMeta,
  emptyText,
}: {
  title: string
  documents: NormalizedDocument[]
  renderMeta: (doc: NormalizedDocument) => string
  emptyText: string
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h2 className="mb-2 text-sm font-medium text-muted-foreground">{title}</h2>
      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="divide-y">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-2 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium">{doc.title}</p>
                <p className="truncate text-xs text-muted-foreground">{renderMeta(doc)}</p>
              </div>
              <a
                href={doc.paperlessUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Open ↗
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function DashboardPage() {
  const { data, isLoading, error } = useDocuments()
  const { filteredDocuments } = useDocumentsFilter()
  const palette = getPalette(useIsDarkMode())
  const [useSharedFilter, setUseSharedFilter] = useState(true)
  const [customCharts, setCustomCharts] = useState<ChartConfig[] | null>(() => getSavedCharts())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingChart, setEditingChart] = useState<ChartConfig | null>(null)
  const [showInsights, setShowInsights] = useState(
    () => localStorage.getItem(INSIGHTS_VISIBLE_KEY) !== 'false',
  )

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

  function saveChart(config: ChartConfig) {
    const exists = charts.some((c) => c.id === config.id)
    persistCharts(exists ? charts.map((c) => (c.id === config.id ? config : c)) : [...charts, config])
  }

  function moveChart(id: string, direction: -1 | 1) {
    const index = charts.findIndex((c) => c.id === id)
    const swapIndex = index + direction
    if (index < 0 || swapIndex < 0 || swapIndex >= charts.length) return
    const next = [...charts]
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
    persistCharts(next)
  }

  function resetCharts() {
    setCustomCharts(null)
    saveDashboardCharts(null)
  }

  function openAddDialog() {
    setEditingChart(null)
    setDialogOpen(true)
  }

  function openEditDialog(config: ChartConfig) {
    setEditingChart(config)
    setDialogOpen(true)
  }

  function toggleInsights() {
    setShowInsights((prev) => {
      const next = !prev
      localStorage.setItem(INSIGHTS_VISIBLE_KEY, String(next))
      return next
    })
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

      <div>
        <button
          type="button"
          onClick={toggleInsights}
          className="mb-2 flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {showInsights ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          Insights
        </button>
        {showInsights && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <DocumentListCard
              title="Recently added"
              documents={computeRecentDocuments(docs, 'addedDate', 8)}
              renderMeta={(doc) =>
                `${doc.correspondent ?? 'No correspondent'} · added ${doc.addedDate?.slice(0, 10) ?? '—'}`
              }
              emptyText="No documents yet."
            />
            <DocumentListCard
              title="Recently modified"
              documents={computeRecentDocuments(docs, 'modifiedDate', 8)}
              renderMeta={(doc) =>
                `${doc.correspondent ?? 'No correspondent'} · modified ${doc.modifiedDate?.slice(0, 10) ?? '—'}`
              }
              emptyText="No documents yet."
            />
            <DocumentListCard
              title="Potential duplicates"
              documents={computeDuplicateDocuments(docs)}
              renderMeta={(doc) =>
                `${doc.duplicateDocumentIds.length} possible duplicate${doc.duplicateDocumentIds.length === 1 ? '' : 's'} (flagged by Paperless)`
              }
              emptyText="No duplicates flagged by Paperless."
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {isLoading && <span className="text-sm text-muted-foreground">Loading…</span>}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={resetCharts}>
            Reset to defaults
          </Button>
          <Button size="sm" onClick={openAddDialog}>
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
        {charts.map((config, index) => {
          const option = buildChartOption(
            config,
            docs,
            customFieldDefs,
            (v) => amountFormatter.format(v),
            (v) => countFormatter.format(v),
            palette,
          )
          return (
            <ChartCard
              key={config.id}
              title={config.title}
              wide={isWideChart(config)}
              onEdit={() => openEditDialog(config)}
              onMoveUp={index > 0 ? () => moveChart(config.id, -1) : undefined}
              onMoveDown={index < charts.length - 1 ? () => moveChart(config.id, 1) : undefined}
              onRemove={() => removeChart(config.id)}
            >
              {option ? (
                <EChart option={option} height={isWideChart(config) ? 220 : 280} />
              ) : (
                <p className="text-sm text-muted-foreground">No data for this chart yet.</p>
              )}
            </ChartCard>
          )
        })}
      </div>

      <AddChartDialog
        key={editingChart?.id ?? 'new'}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={saveChart}
        customFieldDefs={customFieldDefs}
        docs={docs}
        editingConfig={editingChart}
      />
    </div>
  )
}
