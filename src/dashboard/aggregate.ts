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

export function computeGroups(
  docs: NormalizedDocument[],
  dimension: Dimension,
  sumField?: { fieldId: number; currency?: string | null },
): GroupResult[] {
  const groups = new Map<string, GroupResult>()

  function addTo(key: string, label: string, doc: NormalizedDocument) {
    let group = groups.get(key)
    if (!group) {
      group = { key, label, count: 0, sum: 0 }
      groups.set(key, group)
    }
    group.count += 1
    if (sumField) {
      const cf = doc.customFields.find((c) => c.fieldId === sumField.fieldId)
      if (cf?.numericValue != null && (!sumField.currency || cf.currency === sumField.currency)) {
        group.sum += cf.numericValue
      }
    }
  }

  for (const doc of docs) {
    if (dimension.kind === 'customField') {
      const cf = doc.customFields.find((c) => c.fieldId === dimension.fieldId)
      const label = cf?.display ?? 'No value'
      addTo(label, label, doc)
      continue
    }

    switch (dimension.key) {
      case 'correspondent':
        addTo(doc.correspondent ?? '\0', doc.correspondent ?? 'No correspondent', doc)
        break
      case 'documentType':
        addTo(doc.documentType ?? '\0', doc.documentType ?? 'No document type', doc)
        break
      case 'storagePath':
        addTo(doc.storagePath ?? '\0', doc.storagePath ?? 'No storage path', doc)
        break
      case 'tag':
        if (doc.tags.length === 0) {
          addTo('\0', 'No tags', doc)
        } else {
          for (const tag of doc.tags) addTo(String(tag.id), tag.name, doc)
        }
        break
      case 'year':
        if (doc.createdDate) {
          const year = String(new Date(doc.createdDate).getFullYear())
          addTo(year, year, doc)
        } else {
          addTo('\0', 'Unknown', doc)
        }
        break
      case 'month':
        if (doc.createdDate) {
          const { key, label } = monthKeyAndLabel(doc.createdDate)
          addTo(key, label, doc)
        } else {
          addTo('\0', 'Unknown', doc)
        }
        break
    }
  }

  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key))
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
