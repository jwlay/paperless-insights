import type { NormalizedDocument } from '@/models/document'
import type { CustomFieldDef } from '@/parsing/customFields'

export type BuiltinDimensionKey =
  | 'correspondent'
  | 'documentType'
  | 'storagePath'
  | 'tag'
  | 'year'
  | 'month'

export type Dimension =
  | { kind: 'builtin'; key: BuiltinDimensionKey }
  | { kind: 'customField'; fieldId: number }

export interface GroupResult {
  key: string
  label: string
  count: number
  /** Sum of the requested numeric field for this group; 0 if none was requested. */
  sum: number
}

function monthKeyAndLabel(dateStr: string): { key: string; label: string } {
  const date = new Date(dateStr)
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  const label = date.toLocaleDateString(undefined, { year: 'numeric', month: 'short' })
  return { key, label }
}

function classifyByDimension(
  doc: NormalizedDocument,
  dimension: Dimension,
): { key: string; label: string }[] {
  if (dimension.kind === 'customField') {
    const cf = doc.customFields.find((c) => c.fieldId === dimension.fieldId)
    const label = cf?.display ?? 'No value'
    return [{ key: label, label }]
  }
  switch (dimension.key) {
    case 'correspondent':
      return [{ key: doc.correspondent ?? '\0', label: doc.correspondent ?? 'No correspondent' }]
    case 'documentType':
      return [{ key: doc.documentType ?? '\0', label: doc.documentType ?? 'No document type' }]
    case 'storagePath':
      return [{ key: doc.storagePath ?? '\0', label: doc.storagePath ?? 'No storage path' }]
    case 'tag':
      return doc.tags.length === 0
        ? [{ key: '\0', label: 'No tags' }]
        : doc.tags.map((tag) => ({ key: String(tag.id), label: tag.name }))
    case 'year':
      if (doc.createdDate) {
        const year = String(new Date(doc.createdDate).getFullYear())
        return [{ key: year, label: year }]
      }
      return [{ key: '\0', label: 'Unknown' }]
    case 'month':
      if (doc.createdDate) {
        const { key, label } = monthKeyAndLabel(doc.createdDate)
        return [{ key, label }]
      }
      return [{ key: '\0', label: 'Unknown' }]
  }
}

function docNumericValue(
  doc: NormalizedDocument,
  sumField?: { fieldId: number; currency?: string | null },
): number | null {
  if (!sumField) return 1
  const cf = doc.customFields.find((c) => c.fieldId === sumField.fieldId)
  if (cf?.numericValue == null) return null
  if (sumField.currency && cf.currency !== sumField.currency) return null
  return cf.numericValue
}

export function computeGroups(
  docs: NormalizedDocument[],
  dimension: Dimension,
  sumField?: { fieldId: number; currency?: string | null },
): GroupResult[] {
  const groups = new Map<string, GroupResult>()

  for (const doc of docs) {
    const value = sumField ? docNumericValue(doc, sumField) : null
    for (const { key, label } of classifyByDimension(doc, dimension)) {
      let group = groups.get(key)
      if (!group) {
        group = { key, label, count: 0, sum: 0 }
        groups.set(key, group)
      }
      group.count += 1
      if (value != null) group.sum += value
    }
  }

  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key))
}

export interface StackedGroups {
  categories: string[]
  series: { name: string; data: number[] }[]
}

/**
 * Two-dimensional breakdown: `primary` becomes the X-axis categories (top N
 * by total), `stack` becomes the stacked segments within each bar (top 3 +
 * "Other", same categorical-color-safety rule as a pie — a stacked bar has
 * every segment visible at once, same as a pie's slices).
 */
export function computeStackedGroups(
  docs: NormalizedDocument[],
  primary: Dimension,
  stack: Dimension,
  sumField?: { fieldId: number; currency?: string | null },
  limit = 8,
): StackedGroups {
  const primaryTotals = computeGroups(docs, primary, sumField)
  const topPrimary = [...primaryTotals]
    .sort((a, b) => (sumField ? b.sum - a.sum : b.count - a.count))
    .slice(0, limit)
  const primaryKeys = new Set(topPrimary.map((g) => g.key))

  const rankedStack = [...computeGroups(docs, stack, sumField)].sort((a, b) =>
    sumField ? b.sum - a.sum : b.count - a.count,
  )
  const topStack = rankedStack.slice(0, 3)
  const topStackKeys = new Set(topStack.map((g) => g.key))
  const hasOther = rankedStack.length > topStack.length
  const seriesNames = [...topStack.map((g) => g.label), ...(hasOther ? ['Other'] : [])]

  const matrix = new Map<string, Map<string, number>>()
  for (const doc of docs) {
    const value = sumField ? docNumericValue(doc, sumField) : 1
    if (value == null) continue
    const primaryEntries = classifyByDimension(doc, primary).filter((p) => primaryKeys.has(p.key))
    if (primaryEntries.length === 0) continue
    const stackEntries = classifyByDimension(doc, stack)
    for (const p of primaryEntries) {
      let row = matrix.get(p.key)
      if (!row) {
        row = new Map()
        matrix.set(p.key, row)
      }
      for (const s of stackEntries) {
        const seriesLabel = topStackKeys.has(s.key) ? s.label : 'Other'
        row.set(seriesLabel, (row.get(seriesLabel) ?? 0) + value)
      }
    }
  }

  return {
    categories: topPrimary.map((g) => g.label),
    series: seriesNames.map((name) => ({
      name,
      data: topPrimary.map((g) => matrix.get(g.key)?.get(name) ?? 0),
    })),
  }
}

export interface MonthPoint {
  key: string
  label: string
  count: number
}

/** Document counts per month, based on `addedDate` (when it entered Paperless) rather than the document's own date. */
export function computeAddedOverTime(docs: NormalizedDocument[]): MonthPoint[] {
  const points = new Map<string, MonthPoint>()
  for (const doc of docs) {
    if (!doc.addedDate) continue
    const { key, label } = monthKeyAndLabel(doc.addedDate)
    const existing = points.get(key)
    if (existing) {
      existing.count += 1
    } else {
      points.set(key, { key, label, count: 1 })
    }
  }
  return [...points.values()].sort((a, b) => a.key.localeCompare(b.key))
}

export interface DayPoint {
  date: string
  count: number
}

/** Document counts per calendar day — feeds the activity heatmap. */
export function computeDailyActivity(
  docs: NormalizedDocument[],
  field: 'added' | 'created',
): DayPoint[] {
  const counts = new Map<string, number>()
  for (const doc of docs) {
    const raw = field === 'added' ? doc.addedDate : doc.createdDate
    if (!raw) continue
    const date = raw.slice(0, 10)
    counts.set(date, (counts.get(date) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export interface RankedValue {
  id: number
  label: string
  value: number
}

/** Top individual documents by a numeric field's value, scoped to one currency for monetary fields (mixing currencies would be misleading). */
export function computeLargestValues(
  docs: NormalizedDocument[],
  fieldId: number,
  currency: string | null,
  limit = 20,
): RankedValue[] {
  return docs
    .map((doc) => ({ doc, cf: doc.customFields.find((c) => c.fieldId === fieldId) }))
    .filter(
      (row): row is { doc: NormalizedDocument; cf: NonNullable<typeof row.cf> } =>
        row.cf?.numericValue != null && (!currency || row.cf.currency === currency),
    )
    .map((row) => ({
      id: row.doc.id,
      label: row.doc.correspondent ? `${row.doc.correspondent} — ${row.doc.title}` : row.doc.title,
      value: row.cf.numericValue as number,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}

export interface CurrencyCount {
  currency: string
  count: number
}

/** How a monetary field's values are distributed across currencies. */
export function computeCurrencyDistribution(docs: NormalizedDocument[], fieldId: number): CurrencyCount[] {
  const counts = new Map<string, number>()
  for (const doc of docs) {
    const cf = doc.customFields.find((c) => c.fieldId === fieldId)
    if (cf?.currency) counts.set(cf.currency, (counts.get(cf.currency) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([currency, count]) => ({ currency, count }))
    .sort((a, b) => b.count - a.count)
}

export interface MissingFieldCount {
  label: string
  count: number
}

/** Counts of documents missing each piece of metadata — core fields plus every custom field defined. */
export function computeMissingFields(
  docs: NormalizedDocument[],
  customFieldDefs: CustomFieldDef[],
): MissingFieldCount[] {
  const counts = new Map<string, number>()
  for (const doc of docs) {
    if (doc.missingFields.includes('correspondent')) {
      counts.set('Missing correspondent', (counts.get('Missing correspondent') ?? 0) + 1)
    }
    if (doc.missingFields.includes('document type')) {
      counts.set('Missing document type', (counts.get('Missing document type') ?? 0) + 1)
    }
    for (const def of customFieldDefs) {
      const cf = doc.customFields.find((c) => c.fieldId === def.id)
      if (!cf || cf.raw == null) {
        const label = `Missing ${def.name}`
        counts.set(label, (counts.get(label) ?? 0) + 1)
      }
    }
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count)
}

/** Most recently added/modified documents, newest first. */
export function computeRecentDocuments(
  docs: NormalizedDocument[],
  field: 'addedDate' | 'modifiedDate',
  limit = 10,
): NormalizedDocument[] {
  return docs
    .filter((doc) => doc[field] != null)
    .sort((a, b) => (b[field] as string).localeCompare(a[field] as string))
    .slice(0, limit)
}

/** Documents Paperless has itself flagged as having duplicates. */
export function computeDuplicateDocuments(docs: NormalizedDocument[]): NormalizedDocument[] {
  return docs.filter((doc) => doc.duplicateDocumentIds.length > 0)
}
