import type { GroupByDimension } from './aggregate'

export type ChartVisual = 'bar' | 'line' | 'pie'
export type ChartMetric = 'total' | 'count'

export interface GroupedChartConfig {
  id: string
  title: string
  kind: 'grouped'
  dimension: GroupByDimension
  metric: ChartMetric
  visual: ChartVisual
  limit?: number
}

export interface SpecialChartConfig {
  id: string
  title: string
  kind: 'largest-expenses' | 'added-over-time' | 'missing-metadata'
}

export type ChartConfig = GroupedChartConfig | SpecialChartConfig

export const DEFAULT_CHARTS: ChartConfig[] = [
  {
    id: 'default-monthly-spending',
    title: 'Monthly spending',
    kind: 'grouped',
    dimension: 'month',
    metric: 'total',
    visual: 'line',
  },
  {
    id: 'default-by-correspondent',
    title: 'Spending by correspondent',
    kind: 'grouped',
    dimension: 'correspondent',
    metric: 'total',
    visual: 'bar',
    limit: 10,
  },
  {
    id: 'default-by-tag',
    title: 'Spending by tag',
    kind: 'grouped',
    dimension: 'tag',
    metric: 'total',
    visual: 'bar',
    limit: 10,
  },
  {
    id: 'default-currency-distribution',
    title: 'Currency distribution',
    kind: 'grouped',
    dimension: 'currency',
    metric: 'count',
    visual: 'pie',
  },
  {
    id: 'default-top-vendors',
    title: 'Top 20 vendors',
    kind: 'grouped',
    dimension: 'correspondent',
    metric: 'count',
    visual: 'bar',
    limit: 20,
  },
  { id: 'default-largest-expenses', title: 'Largest expenses', kind: 'largest-expenses' },
  { id: 'default-added-over-time', title: 'Documents added over time', kind: 'added-over-time' },
  { id: 'default-missing-metadata', title: 'Missing metadata', kind: 'missing-metadata' },
]

const STORAGE_KEY = 'paperless-insights:dashboard-charts'

export function getDashboardCharts(): ChartConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ChartConfig[]) : DEFAULT_CHARTS
  } catch {
    return DEFAULT_CHARTS
  }
}

export function saveDashboardCharts(charts: ChartConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(charts))
}
