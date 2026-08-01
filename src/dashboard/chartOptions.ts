import type { EChartsOption } from 'echarts'
import type { NormalizedDocument } from '@/models/document'
import type { CustomFieldDef } from '@/parsing/customFields'
import {
  computeAddedOverTime,
  computeCurrencyDistribution,
  computeDailyActivity,
  computeGroups,
  computeLargestValues,
  computeMissingFields,
  computeStackedGroups,
  type StackedGroups,
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
    xAxis: {
      type: 'value',
      // Without headroom, the longest bar's end-label sits exactly on the
      // plot edge and gets clipped instead of shown — always leave room.
      max: (value: { max: number }) => (value.max <= 0 ? 1 : Math.ceil(value.max * 1.15)),
      ...baseAxis,
      splitLine: { lineStyle: { color: palette.ink.gridline } },
    },
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

// A stacked bar has every segment visible at once (same as a pie), so the
// stack dimension is already capped to top-3 + "Other" by computeStackedGroups.
export function stackedBarOption(
  data: StackedGroups,
  valueFormatter: (v: number) => string,
  palette: ChartPalette,
): EChartsOption {
  const hasOther = data.series.some((s) => s.name === 'Other')
  const namedCount = hasOther ? data.series.length - 1 : data.series.length
  const seriesColors = [
    ...palette.categorical.slice(0, namedCount),
    ...(hasOther ? [palette.categoricalOther] : []),
  ]
  return {
    grid: { left: 8, right: 16, top: 32, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (v) => valueFormatter(Number(v)),
    },
    legend: { top: 0, textStyle: { color: palette.ink.secondary } },
    xAxis: {
      type: 'category',
      data: data.categories,
      axisLabel: {
        color: palette.ink.muted,
        rotate: data.categories.length > 6 ? 30 : 0,
        width: 100,
        overflow: 'truncate',
      },
      axisLine: { lineStyle: { color: palette.ink.axis } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: palette.ink.muted },
      splitLine: { lineStyle: { color: palette.ink.gridline } },
    },
    series: data.series.map((s, i) => ({
      name: s.name,
      type: 'bar',
      stack: 'total',
      data: s.data,
      itemStyle: { color: seriesColors[i] },
    })),
  }
}

// GitHub-style contribution calendar over the trailing 12 months of data.
export function calendarHeatmapOption(
  points: { date: string; count: number }[],
  palette: ChartPalette,
): EChartsOption {
  const maxDate = points[points.length - 1].date
  const start = new Date(maxDate)
  start.setDate(start.getDate() - 364)
  const startDate = start.toISOString().slice(0, 10)
  const maxCount = Math.max(...points.map((p) => p.count), 1)

  return {
    tooltip: { position: 'top' },
    visualMap: {
      min: 0,
      max: maxCount,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      top: 0,
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: palette.ink.muted, fontSize: 10 },
      inRange: { color: [palette.surface, palette.accent] },
    },
    calendar: {
      top: 40,
      range: [startDate, maxDate],
      cellSize: [16, 16],
      itemStyle: { borderWidth: 2, borderColor: palette.surface, color: palette.ink.gridline },
      dayLabel: { color: palette.ink.muted, fontSize: 10 },
      monthLabel: { color: palette.ink.muted, fontSize: 10 },
      yearLabel: { show: false },
      splitLine: { show: false },
    },
    series: [
      {
        type: 'heatmap',
        coordinateSystem: 'calendar',
        data: points.map((p) => [p.date, p.count]),
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
    case 'stacked-bar': {
      const metric = config.metric
      const isSum = metric.kind === 'sum'
      const data = computeStackedGroups(
        docs,
        config.primary,
        config.stack,
        isSum ? { fieldId: metric.fieldId, currency: metric.currency } : undefined,
      )
      if (data.categories.length === 0) return null
      return stackedBarOption(data, isSum ? amountFormatter : countFormatter, palette)
    }
    case 'activity-calendar': {
      const points = computeDailyActivity(docs, config.field)
      if (points.length === 0) return null
      return calendarHeatmapOption(points, palette)
    }
  }
}
