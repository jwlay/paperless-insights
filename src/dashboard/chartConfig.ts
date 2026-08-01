import type { NormalizedDocument } from '@/models/document'
import type { CustomFieldDef } from '@/parsing/customFields'
import type { Dimension } from './aggregate'

export type ChartVisual = 'bar' | 'line' | 'pie'
export type Metric = { kind: 'count' } | { kind: 'sum'; fieldId: number; currency: string | null }

export interface GroupedChartConfig {
  id: string
  title: string
  kind: 'grouped'
  dimension: Dimension
  metric: Metric
  visual: ChartVisual
  limit?: number
}

export interface LargestValuesChartConfig {
  id: string
  title: string
  kind: 'largest-values'
  fieldId: number
  currency: string | null
}

export interface CurrencyDistributionChartConfig {
  id: string
  title: string
  kind: 'currency-distribution'
  fieldId: number
}

export interface AddedOverTimeChartConfig {
  id: string
  title: string
  kind: 'added-over-time'
}

export interface MissingFieldsChartConfig {
  id: string
  title: string
  kind: 'missing-fields'
}

export interface StackedBarChartConfig {
  id: string
  title: string
  kind: 'stacked-bar'
  primary: Dimension
  stack: Dimension
  metric: Metric
}

export interface ActivityCalendarChartConfig {
  id: string
  title: string
  kind: 'activity-calendar'
  field: 'added' | 'created'
}

export type ChartConfig =
  | GroupedChartConfig
  | LargestValuesChartConfig
  | CurrencyDistributionChartConfig
  | AddedOverTimeChartConfig
  | MissingFieldsChartConfig
  | StackedBarChartConfig
  | ActivityCalendarChartConfig

function mostCommonCurrency(docs: NormalizedDocument[], fieldId: number): string | null {
  const counts = new Map<string, number>()
  for (const doc of docs) {
    const cf = doc.customFields.find((c) => c.fieldId === fieldId)
    if (cf?.currency) counts.set(cf.currency, (counts.get(cf.currency) ?? 0) + 1)
  }
  let best: string | null = null
  let bestCount = 0
  for (const [currency, count] of counts) {
    if (count > bestCount) {
      best = currency
      bestCount = count
    }
  }
  return best
}

/**
 * Live defaults, recomputed from whatever custom fields actually exist —
 * this app doesn't assume a particular field, so the monetary-flavored
 * charts only appear once a monetary custom field is actually found.
 */
export function getDefaultCharts(customFieldDefs: CustomFieldDef[], docs: NormalizedDocument[]): ChartConfig[] {
  const charts: ChartConfig[] = [
    {
      id: 'default-by-correspondent',
      title: 'Documents by correspondent',
      kind: 'grouped',
      dimension: { kind: 'builtin', key: 'correspondent' },
      metric: { kind: 'count' },
      visual: 'bar',
      limit: 10,
    },
    {
      id: 'default-by-tag',
      title: 'Documents by tag',
      kind: 'grouped',
      dimension: { kind: 'builtin', key: 'tag' },
      metric: { kind: 'count' },
      visual: 'bar',
      limit: 10,
    },
    {
      id: 'default-by-type',
      title: 'Documents by type',
      kind: 'grouped',
      dimension: { kind: 'builtin', key: 'documentType' },
      metric: { kind: 'count' },
      // Bar rather than pie — a pie folds to top-3 + Other, which loses
      // detail for anyone with more than a few document types defined.
      visual: 'bar',
      limit: 10,
    },
    { id: 'default-added-over-time', title: 'Documents added over time', kind: 'added-over-time' },
    { id: 'default-activity-calendar', title: 'Activity calendar', kind: 'activity-calendar', field: 'added' },
    { id: 'default-missing-fields', title: 'Missing metadata', kind: 'missing-fields' },
  ]

  const monetary = customFieldDefs.find((d) => d.dataType === 'monetary')
  if (monetary) {
    const currency = mostCommonCurrency(docs, monetary.id)
    charts.push(
      {
        id: 'default-monthly-total',
        title: `Monthly total — ${monetary.name}${currency ? ` (${currency})` : ''}`,
        kind: 'grouped',
        dimension: { kind: 'builtin', key: 'month' },
        metric: { kind: 'sum', fieldId: monetary.id, currency },
        visual: 'line',
      },
      {
        id: 'default-by-correspondent-total',
        title: `${monetary.name} by correspondent${currency ? ` (${currency})` : ''}`,
        kind: 'grouped',
        dimension: { kind: 'builtin', key: 'correspondent' },
        metric: { kind: 'sum', fieldId: monetary.id, currency },
        visual: 'bar',
        limit: 10,
      },
      {
        id: 'default-largest-values',
        title: `Largest ${monetary.name} values${currency ? ` (${currency})` : ''}`,
        kind: 'largest-values',
        fieldId: monetary.id,
        currency,
      },
      {
        id: 'default-currency-distribution',
        title: `${monetary.name} currency distribution`,
        kind: 'currency-distribution',
        fieldId: monetary.id,
      },
    )
  }

  return charts
}

const STORAGE_KEY = 'paperless-insights:dashboard-charts:v2'

/** null means "no explicit customization yet — use live defaults." */
export function getSavedCharts(): ChartConfig[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ChartConfig[]) : null
  } catch {
    return null
  }
}

export function saveDashboardCharts(charts: ChartConfig[] | null) {
  if (charts === null) {
    localStorage.removeItem(STORAGE_KEY)
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(charts))
  }
}
