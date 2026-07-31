import type { EChartsOption } from 'echarts'
import type { NormalizedDocument } from '@/models/document'
import type { CustomFieldDef } from '@/parsing/customFields'
import {
  computeAddedOverTime,
  computeCurrencyDistribution,
  computeGroups,
  computeLargestValues,
  computeMissingFields,
} from './aggregate'
import type { ChartConfig } from './chartConfig'
import type { ChartPalette } from './colors'

export function rankedBarOption(
  items: { label: string; value: number }[],
  color: string,
  valueFormatter: (v: number) => string,
  palette: ChartPalette,
): EChartsOption {
  const sorted = [...items].sort((a, b) => a.value - b.value)
  const baseAxis = {
    axisLabel: { color: palette.ink.muted },
    axisLine: { lineStyle: { color: palette.ink.axis } },
  }
  return {
    grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (v) => valueFormatter(Number(v)),
    },
    xAxis: { type: 'value', ...baseAxis, splitLine: { lineStyle: { color: palette.ink.gridline } } },
    yAxis: {
      type: 'category',
      data: sorted.map((i) => i.label),
      axisLabel: { color: palette.ink.secondary, width: 140, overflow: 'truncate' },
      axisLine: { lineStyle: { color: palette.ink.axis } },
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
          color: palette.ink.primary,
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
  palette: ChartPalette,
): EChartsOption {
  const baseAxis = {
    axisLabel: { color: palette.ink.muted },
    axisLine: { lineStyle: { color: palette.ink.axis } },
  }
  return {
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', valueFormatter: (v) => valueFormatter(Number(v)) },
    xAxis: {
      type: 'category',
      data: points.map((p) => p.label),
      ...baseAxis,
      axisLabel: { ...baseAxis.axisLabel, rotate: points.length > 8 ? 45 : 0 },
    },
    yAxis: { type: 'value', ...baseAxis, splitLine: { lineStyle: { color: palette.ink.gridline } } },
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
              color: palette.ink.primary,
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
export function pieOptionFromItems(
  items: { label: string; value: number }[],
  palette: ChartPalette,
): EChartsOption {
  const sorted = [...items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value)
  const top = sorted.slice(0, 3)
  const rest = sorted.slice(3)
  const restSum = rest.reduce((sum, i) => sum + i.value, 0)
  const data = top.map((i) => ({ name: i.label, value: i.value }))
  if (restSum > 0) data.push({ name: 'Other', value: restSum })
  const colors = [
    ...palette.categorical.slice(0, top.length),
    ...(restSum > 0 ? [palette.categoricalOther] : []),
  ]
  return {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: palette.ink.secondary } },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        data,
        color: colors,
        itemStyle: { borderColor: palette.surface, borderWidth: 2 },
        label: { color: palette.ink.secondary, formatter: '{b}: {c}' },
      },
    ],
  }
}

export function buildChartOption(
  config: ChartConfig,
  docs: NormalizedDocument[],
  customFieldDefs: CustomFieldDef[],
  amountFormatter: (v: number) => string,
  countFormatter: (v: number) => string,
  palette: ChartPalette,
): EChartsOption | null {
  switch (config.kind) {
    case 'largest-values': {
      const entries = computeLargestValues(docs, config.fieldId, config.currency, 20)
      if (entries.length === 0) return null
      return rankedBarOption(
        entries.map((e) => ({ label: e.label, value: e.value })),
        palette.accent,
        amountFormatter,
        palette,
      )
    }
    case 'currency-distribution': {
      const dist = computeCurrencyDistribution(docs, config.fieldId)
      if (dist.length === 0) return null
      return pieOptionFromItems(
        dist.map((d) => ({ label: d.currency, value: d.count })),
        palette,
      )
    }
    case 'added-over-time': {
      const points = computeAddedOverTime(docs)
      return timeSeriesOption(
        points.map((p) => ({ label: p.label, value: p.count })),
        palette.accent,
        'bar',
        countFormatter,
        palette,
      )
    }
    case 'missing-fields': {
      const reasons = computeMissingFields(docs, customFieldDefs)
      if (reasons.length === 0) return null
      return rankedBarOption(
        reasons.map((r) => ({ label: r.label, value: r.count })),
        palette.warning,
        countFormatter,
        palette,
      )
    }
    case 'grouped': {
      const metric = config.metric
      const isSum = metric.kind === 'sum'
      const groups = computeGroups(
        docs,
        config.dimension,
        metric.kind === 'sum' ? { fieldId: metric.fieldId, currency: metric.currency } : undefined,
      )
      const valueFormatter = isSum ? amountFormatter : countFormatter
      const items = groups.map((g) => ({ label: g.label, value: isSum ? g.sum : g.count }))

      if (config.visual === 'pie') {
        return pieOptionFromItems(items, palette)
      }
      if (config.visual === 'line') {
        return timeSeriesOption(items, palette.accent, 'line', valueFormatter, palette)
      }
      const limited = items
        .filter((i) => i.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, config.limit ?? 10)
      return rankedBarOption(limited, palette.accent, valueFormatter, palette)
    }
  }
}
