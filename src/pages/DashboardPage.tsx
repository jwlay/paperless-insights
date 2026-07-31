import { useMemo, useState } from 'react'
import { useDocuments } from '@/api/queries'
import { computeGroups, type GroupByDimension } from '@/dashboard/aggregate'
import { GroupBarChart } from '@/dashboard/GroupBarChart'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const DIMENSIONS: { id: GroupByDimension; label: string }[] = [
  { id: 'correspondent', label: 'Correspondent' },
  { id: 'tag', label: 'Tag' },
  { id: 'documentType', label: 'Document type' },
  { id: 'storagePath', label: 'Storage path' },
  { id: 'currency', label: 'Currency' },
  { id: 'year', label: 'Year' },
  { id: 'month', label: 'Month' },
]

const countFormatter = new Intl.NumberFormat(undefined)
const amountFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function DashboardPage() {
  const { data, isLoading, error } = useDocuments()
  const [dimension, setDimension] = useState<GroupByDimension>('correspondent')
  const [currency, setCurrency] = useState<string | null>(null)

  const currencies = useMemo(() => {
    const set = new Set<string>()
    for (const doc of data ?? []) if (doc.currency) set.add(doc.currency)
    return [...set].sort()
  }, [data])

  const activeCurrency = currency ?? currencies[0] ?? null
  const dimensionLabel = DIMENSIONS.find((d) => d.id === dimension)?.label ?? ''

  const groups = useMemo(() => computeGroups(data ?? [], dimension), [data, dimension])
  const groupsByCount = useMemo(
    () => [...groups].sort((a, b) => b.count - a.count),
    [groups],
  )

  if (error) {
    return <div className="p-6 text-destructive">Failed to load documents: {error.message}</div>
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Group by</span>
          <Select value={dimension} onValueChange={(value) => setDimension(value as GroupByDimension)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIMENSIONS.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Top {dimensionLabel.toLowerCase()} by total{activeCurrency ? ` (${activeCurrency})` : ''}
        </h2>
        <GroupBarChart
          groups={groups}
          valueOf={(group) => (activeCurrency ? (group.totalsByCurrency.get(activeCurrency) ?? 0) : 0)}
          valueLabel={(value) => amountFormatter.format(value)}
        />
      </div>

      <div className="overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">{dimensionLabel}</th>
              <th className="px-3 py-2 font-medium">Documents</th>
              <th className="px-3 py-2 font-medium">Totals</th>
            </tr>
          </thead>
          <tbody>
            {groupsByCount.map((group) => (
              <tr key={group.key} className="border-t">
                <td className="px-3 py-2">{group.label}</td>
                <td className="px-3 py-2 tabular-nums">{countFormatter.format(group.count)}</td>
                <td className="px-3 py-2 tabular-nums">
                  {[...group.totalsByCurrency.entries()]
                    .map(([c, total]) => `${c} ${amountFormatter.format(total)}`)
                    .join(' · ') || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
