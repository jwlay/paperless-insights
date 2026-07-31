import { useCallback, useMemo, useRef, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { themeQuartz } from 'ag-grid-community'
import type { ColDef, GridApi, GridReadyEvent, RowClassParams } from 'ag-grid-community'
import { RefreshCw } from 'lucide-react'
import { useDocuments } from '@/api/queries'
import type { NormalizedDocument } from '@/models/document'
import { documentColumnDefs } from '@/grid/columns'
import { getSavedViews, type SavedView } from '@/grid/savedViews'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ColumnVisibilityMenu } from '@/components/ColumnVisibilityMenu'
import { ViewsMenu, type BuiltInViewId } from '@/components/ViewsMenu'
import { cn } from '@/lib/utils'

const gridTheme = themeQuartz.withParams({
  accentColor: 'var(--primary)',
  borderRadius: 8,
  wrapperBorderRadius: 10,
  headerFontWeight: 600,
})

const countFormatter = new Intl.NumberFormat(undefined)
const amountFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function applyBuiltInView(data: NormalizedDocument[], view: BuiltInViewId): NormalizedDocument[] {
  switch (view) {
    case 'missing-amount':
      return data.filter((doc) => doc.missingFields.includes('amount'))
    case 'missing-correspondent':
      return data.filter((doc) => doc.missingFields.includes('correspondent'))
    case 'year': {
      const currentYear = new Date().getFullYear()
      return data.filter(
        (doc) => doc.createdDate && new Date(doc.createdDate).getFullYear() === currentYear,
      )
    }
    case 'last30': {
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
      return data.filter((doc) => doc.createdDate && new Date(doc.createdDate).getTime() >= cutoff)
    }
    default:
      return data
  }
}

function StatTile({
  label,
  value,
  warn,
}: {
  label: string
  value: string
  warn?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border bg-card px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 text-xl font-semibold">
        {warn && <span className="h-2 w-2 shrink-0 rounded-full bg-[#fab219]" aria-hidden="true" />}
        {value}
      </span>
    </div>
  )
}

export function DocumentsGrid() {
  const { data, isLoading, isFetching, error, refetch } = useDocuments()
  const gridApiRef = useRef<GridApi<NormalizedDocument> | null>(null)
  const [quickFilter, setQuickFilter] = useState('')
  const [builtInView, setBuiltInView] = useState<BuiltInViewId>('all')
  const [hiddenFields, setHiddenFields] = useState<Set<string>>(() => new Set())
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => getSavedViews())

  const viewData = useMemo(() => applyBuiltInView(data ?? [], builtInView), [data, builtInView])

  // Column visibility is driven entirely by this state (not by imperative grid
  // API calls) so it can never fight with the declarative columnDefs prop.
  const columnDefs = useMemo<ColDef<NormalizedDocument>[]>(
    () =>
      documentColumnDefs.map((col) =>
        col.field ? { ...col, hide: hiddenFields.has(col.field) } : col,
      ),
    [hiddenFields],
  )

  const toggleColumn = useCallback((field: string, visible: boolean) => {
    setHiddenFields((prev) => {
      const next = new Set(prev)
      if (visible) next.delete(field)
      else next.add(field)
      return next
    })
  }, [])

  const summary = useMemo(() => {
    let missing = 0
    const totalsByCurrency = new Map<string, number>()
    for (const doc of viewData) {
      if (doc.hasMissingMetadata) missing += 1
      if (doc.amount != null && doc.currency) {
        totalsByCurrency.set(doc.currency, (totalsByCurrency.get(doc.currency) ?? 0) + doc.amount)
      }
    }
    return { count: viewData.length, missing, totalsByCurrency }
  }, [viewData])

  const defaultColDef = useMemo<ColDef>(
    () => ({ sortable: true, filter: true, resizable: true }),
    [],
  )

  const getRowClass = useCallback(
    (params: RowClassParams<NormalizedDocument>) =>
      params.data?.hasMissingMetadata ? 'bg-amber-50 dark:bg-amber-950/40' : undefined,
    [],
  )

  const onGridReady = useCallback((e: GridReadyEvent<NormalizedDocument>) => {
    gridApiRef.current = e.api
  }, [])

  const exportCsv = useCallback(() => {
    gridApiRef.current?.exportDataAsCsv({ fileName: 'paperless-insights-documents.csv' })
  }, [])

  if (error) {
    return <div className="p-6 text-destructive">Failed to load documents: {error.message}</div>
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex flex-wrap gap-2">
        <StatTile label="Documents" value={countFormatter.format(summary.count)} />
        {[...summary.totalsByCurrency.entries()].map(([currency, total]) => (
          <StatTile key={currency} label={`${currency} total`} value={amountFormatter.format(total)} />
        ))}
        <StatTile
          label="Missing metadata"
          value={countFormatter.format(summary.missing)}
          warn={summary.missing > 0}
        />
      </div>

      <div className="flex items-center gap-2">
        <Input
          placeholder="Search documents…"
          value={quickFilter}
          onChange={(e) => setQuickFilter(e.target.value)}
          className="max-w-sm"
        />
        <ViewsMenu
          gridApiRef={gridApiRef}
          quickFilter={quickFilter}
          onQuickFilterChange={setQuickFilter}
          onBuiltInViewChange={setBuiltInView}
          savedViews={savedViews}
          onSavedViewsChange={setSavedViews}
        />
        <ColumnVisibilityMenu
          columnDefs={documentColumnDefs}
          hiddenFields={hiddenFields}
          onToggle={toggleColumn}
        />
        <Button variant="outline" onClick={exportCsv}>
          Export CSV
        </Button>
        <Button variant="outline" size="icon" onClick={() => refetch()} aria-label="Refresh documents">
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
        </Button>
        <span className={cn('ml-auto text-sm text-muted-foreground', isLoading && 'animate-pulse')}>
          {isLoading ? 'Loading…' : `${countFormatter.format(viewData.length)} shown`}
        </span>
      </div>

      <div className="min-h-0 flex-1">
        <AgGridReact<NormalizedDocument>
          theme={gridTheme}
          rowData={viewData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          quickFilterText={quickFilter}
          getRowClass={getRowClass}
          onGridReady={onGridReady}
          animateRows
          loading={isLoading}
        />
      </div>
    </div>
  )
}
