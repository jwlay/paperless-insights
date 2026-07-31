import { useMemo, useState } from 'react'
import type { EChartsOption } from 'echarts'
import { useDocuments } from '@/api/queries'
import {
  computeAddedOverTime,
  computeGroups,
  computeLargestExpenses,
  computeMissingReasons,
} from '@/dashboard/aggregate'
import { EChart } from '@/dashboard/EChart'
import { ACCENT, CATEGORICAL, CATEGORICAL_OTHER, INK, WARNING } from '@/dashboard/colors'
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

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h2 className="mb-2 text-sm font-medium text-muted-foreground">{title}</h2>
      {children}
    </div>
  )
}

const baseAxis = {
  axisLabel: { color: INK.muted },
  axisLine: { lineStyle: { color: INK.axis } },
}

function rankedBarOption(
  items: { label: string; value: number }[],
  color: string,
  valueFormatter: (v: number) => string,
): EChartsOption {
  const sorted = [...items].sort((a, b) => a.value - b.value)
  return {
    grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (v) => valueFormatter(Number(v)),
    },
    xAxis: { type: 'value', ...baseAxis, splitLine: { lineStyle: { color: INK.gridline } } },
    yAxis: {
      type: 'category',
      data: sorted.map((i) => i.label),
      axisLabel: { color: INK.secondary, width: 140, overflow: 'truncate' },
      axisLine: { lineStyle: { color: INK.axis } },
      splitLine: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: sorted.map((i) => i.value),
        itemStyle: { color, borderRadius: [0, 4, 4, 0] },
        label: {
          show: true,
          position: 'right',
          color: INK.primary,
          formatter: (p) => valueFormatter(Number(p.value)),
        },
        barMaxWidth: 20,
      },
    ],
  }
}

function timeSeriesOption(
  points: { label: string; value: number }[],
  color: string,
  kind: 'line' | 'bar',
  valueFormatter: (v: number) => string,
): EChartsOption {
  return {
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (v) => valueFormatter(Number(v)),
    },
    xAxis: {
      type: 'category',
      data: points.map((p) => p.label),
      ...baseAxis,
      axisLabel: { ...baseAxis.axisLabel, rotate: points.length > 8 ? 45 : 0 },
    },
    yAxis: { type: 'value', ...baseAxis, splitLine: { lineStyle: { color: INK.gridline } } },
    series: [
      kind === 'line'
        ? {
            type: 'line',
            data: points.map((p) => p.value),
            color,
            lineStyle: { width: 2 },
            symbolSize: 6,
            areaStyle: { color, opacity: 0.1 },
            endLabel: {
              show: true,
              formatter: (p) => valueFormatter(Number(p.value)),
              color: INK.primary,
            },
          }
        : {
            type: 'bar',
            data: points.map((p) => p.value),
            itemStyle: { color, borderRadius: [4, 4, 0, 0] },
            barMaxWidth: 24,
          },
    ],
  }
}

export function DashboardPage() {
  const { data, isLoading, error } = useDocuments()
  const [currency, setCurrency] = useState<string | null>(null)

  const docs = data ?? []

  const currencies = useMemo(() => {
    const set = new Set<string>()
    for (const doc of docs) if (doc.currency) set.add(doc.currency)
    return [...set].sort()
  }, [docs])

  const activeCurrency = currency ?? currencies[0] ?? null

  const monthlySpending = useMemo(() => {
    const groups = computeGroups(docs, 'month')
    return groups.map((g) => ({
      label: g.label,
      value: activeCurrency ? (g.totalsByCurrency.get(activeCurrency) ?? 0) : 0,
    }))
  }, [docs, activeCurrency])

  const spendingByCorrespondent = useMemo(() => {
    const groups = computeGroups(docs, 'correspondent')
    return groups
      .map((g) => ({ label: g.label, value: activeCurrency ? (g.totalsByCurrency.get(activeCurrency) ?? 0) : 0 }))
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [docs, activeCurrency])

  const spendingByTag = useMemo(() => {
    const groups = computeGroups(docs, 'tag')
    return groups
      .map((g) => ({ label: g.label, value: activeCurrency ? (g.totalsByCurrency.get(activeCurrency) ?? 0) : 0 }))
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [docs, activeCurrency])

  const currencyDistribution = useMemo(() => {
    const groups = [...computeGroups(docs, 'currency')].sort((a, b) => b.count - a.count)
    const top = groups.slice(0, 3)
    const rest = groups.slice(3)
    const restCount = rest.reduce((sum, g) => sum + g.count, 0)
    const items = top.map((g) => ({ name: g.label, value: g.count }))
    if (restCount > 0) items.push({ name: 'Other', value: restCount })
    const colors = [...CATEGORICAL.slice(0, top.length), ...(restCount > 0 ? [CATEGORICAL_OTHER] : [])]
    return { items, colors }
  }, [docs])

  const topVendorsByCount = useMemo(() => {
    const groups = computeGroups(docs, 'correspondent')
    return [...groups]
      .map((g) => ({ label: g.label, value: g.count }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20)
  }, [docs])

  const largestExpenses = useMemo(
    () => (activeCurrency ? computeLargestExpenses(docs, activeCurrency, 20) : []),
    [docs, activeCurrency],
  )

  const addedOverTime = useMemo(() => computeAddedOverTime(docs), [docs])
  const missingReasons = useMemo(() => computeMissingReasons(docs), [docs])

  if (error) {
    return <div className="p-6 text-destructive">Failed to load documents: {error.message}</div>
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
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
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title={`Monthly spending${activeCurrency ? ` (${activeCurrency})` : ''}`}>
          <EChart option={timeSeriesOption(monthlySpending, ACCENT, 'line', (v) => amountFormatter.format(v))} />
        </ChartCard>

        <ChartCard title={`Spending by correspondent${activeCurrency ? ` (${activeCurrency})` : ''}`}>
          <EChart option={rankedBarOption(spendingByCorrespondent, ACCENT, (v) => amountFormatter.format(v))} />
        </ChartCard>

        <ChartCard title={`Spending by tag${activeCurrency ? ` (${activeCurrency})` : ''}`}>
          <EChart option={rankedBarOption(spendingByTag, ACCENT, (v) => amountFormatter.format(v))} />
        </ChartCard>

        <ChartCard title="Currency distribution (documents)">
          <EChart
            option={{
              tooltip: { trigger: 'item' },
              legend: { bottom: 0, textStyle: { color: INK.secondary } },
              series: [
                {
                  type: 'pie',
                  radius: ['45%', '70%'],
                  data: currencyDistribution.items,
                  color: currencyDistribution.colors,
                  itemStyle: { borderColor: '#fcfcfb', borderWidth: 2 },
                  label: { color: INK.secondary, formatter: '{b}: {c}' },
                },
              ],
            }}
          />
        </ChartCard>

        <ChartCard title="Top 20 vendors (by document count)">
          <EChart
            option={rankedBarOption(topVendorsByCount, ACCENT, (v) => countFormatter.format(v))}
            height={420}
          />
        </ChartCard>

        <ChartCard title={`Largest expenses${activeCurrency ? ` (${activeCurrency})` : ''}`}>
          <EChart
            option={rankedBarOption(
              largestExpenses.map((e) => ({ label: e.label, value: e.amount })),
              ACCENT,
              (v) => amountFormatter.format(v),
            )}
            height={420}
          />
        </ChartCard>

        <ChartCard title="Documents added over time">
          <EChart
            option={timeSeriesOption(
              addedOverTime.map((p) => ({ label: p.label, value: p.count })),
              ACCENT,
              'bar',
              (v) => countFormatter.format(v),
            )}
          />
        </ChartCard>

        <ChartCard title="Missing metadata">
          <EChart
            option={rankedBarOption(
              missingReasons.map((r) => ({ label: r.reason, value: r.count })),
              WARNING,
              (v) => countFormatter.format(v),
            )}
          />
        </ChartCard>
      </div>
    </div>
  )
}
