import type { EChartsOption } from 'echarts'
import type { NormalizedDocument } from '@/models/document'
import {
  computeAddedOverTime,
  computeGroups,
  computeLargestExpenses,
  computeMissingReasons,
} from './aggregate'
import type { ChartConfig } from './chartConfig'
import { ACCENT, CATEGORICAL, CATEGORICAL_OTHER, INK, WARNING } from './colors'

const baseAxis = {
  axisLabel: { color: INK.muted },
  axisLine: { lineStyle: { color: INK.axis } },
}

export function rankedBarOption(
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

export function timeSeriesOption(
  points: { label: string; value: number }[],
  color: string,
  kind: 'line' | 'bar',
  valueFormatter: (v: number) => string,
): EChartsOption {
  return {
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', valueFormatter: (v) => valueFormatter(Number(v)) },
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

// Pies are an "all slices visible at once" context, so only the first 3
// categorical slots (validated all-pairs) are used — everything past that
// folds into "Other" rather than generating an unvalidated 4th+ hue.
export function pieOptionFromItems(items: { label: string; value: number }[]): EChartsOption {
  const sorted = [...items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value)
  const top = sorted.slice(0, 3)
  const rest = sorted.slice(3)
  const restSum = rest.reduce((sum, i) => sum + i.value, 0)
  const data = top.map((i) => ({ name: i.label, value: i.value }))
  if (restSum > 0) data.push({ name: 'Other', value: restSum })
  const colors = [...CATEGORICAL.slice(0, top.length), ...(restSum > 0 ? [CATEGORICAL_OTHER] : [])]
  return {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: INK.secondary } },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        data,
        color: colors,
        itemStyle: { borderColor: '#fcfcfb', borderWidth: 2 },
        label: { color: INK.secondary, formatter: '{b}: {c}' },
      },
    ],
  }
}

export function buildChartOption(
  config: ChartConfig,
  docs: NormalizedDocument[],
  currency: string | null,
  amountFormatter: (v: number) => string,
  countFormatter: (v: number) => string,
): EChartsOption | null {
  switch (config.kind) {
    case 'largest-expenses': {
      if (!currency) return null
      const entries = computeLargestExpenses(docs, currency, 20)
      return rankedBarOption(
        entries.map((e) => ({ label: e.label, value: e.amount })),
        ACCENT,
        amountFormatter,
      )
    }
    case 'added-over-time': {
      const points = computeAddedOverTime(docs)
      return timeSeriesOption(
        points.map((p) => ({ label: p.label, value: p.count })),
        ACCENT,
        'bar',
        countFormatter,
      )
    }
    case 'missing-metadata': {
      const reasons = computeMissingReasons(docs)
      return rankedBarOption(
        reasons.map((r) => ({ label: r.reason, value: r.count })),
        WARNING,
        countFormatter,
      )
    }
    case 'grouped': {
      const groups = computeGroups(docs, config.dimension)
      const valueFormatter = config.metric === 'total' ? amountFormatter : countFormatter
      const items = groups.map((g) => ({
        label: g.label,
        value:
          config.metric === 'total' ? (currency ? (g.totalsByCurrency.get(currency) ?? 0) : 0) : g.count,
      }))

      if (config.visual === 'pie') {
        return pieOptionFromItems(items)
      }
      if (config.visual === 'line') {
        return timeSeriesOption(items, ACCENT, 'line', valueFormatter)
      }
      const limited = items
        .filter((i) => i.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, config.limit ?? 10)
      return rankedBarOption(limited, ACCENT, valueFormatter)
    }
  }
}
