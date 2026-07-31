import type { NormalizedDocument } from '@/models/document'

export type GroupByDimension =
  | 'correspondent'
  | 'documentType'
  | 'storagePath'
  | 'currency'
  | 'tag'
  | 'year'
  | 'month'

export interface GroupSummary {
  key: string
  label: string
  count: number
  totalsByCurrency: Map<string, number>
}

function monthKeyAndLabel(dateStr: string): { key: string; label: string } {
  const date = new Date(dateStr)
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  const label = date.toLocaleDateString(undefined, { year: 'numeric', month: 'short' })
  return { key, label }
}

export function computeGroups(
  docs: NormalizedDocument[],
  dimension: GroupByDimension,
): GroupSummary[] {
  const groups = new Map<string, GroupSummary>()

  function addTo(key: string, label: string, doc: NormalizedDocument) {
    let group = groups.get(key)
    if (!group) {
      group = { key, label, count: 0, totalsByCurrency: new Map() }
      groups.set(key, group)
    }
    group.count += 1
    if (doc.amount != null && doc.currency) {
      group.totalsByCurrency.set(
        doc.currency,
        (group.totalsByCurrency.get(doc.currency) ?? 0) + doc.amount,
      )
    }
  }

  for (const doc of docs) {
    switch (dimension) {
      case 'correspondent':
        addTo(doc.correspondent ?? '\0', doc.correspondent ?? 'No correspondent', doc)
        break
      case 'documentType':
        addTo(doc.documentType ?? '\0', doc.documentType ?? 'No document type', doc)
        break
      case 'storagePath':
        addTo(doc.storagePath ?? '\0', doc.storagePath ?? 'No storage path', doc)
        break
      case 'currency':
        addTo(doc.currency ?? '\0', doc.currency ?? 'No currency', doc)
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

export interface ExpenseEntry {
  id: number
  label: string
  amount: number
}

/** Top individual documents by amount, in a single currency (mixing currencies in one ranking would be misleading). */
export function computeLargestExpenses(
  docs: NormalizedDocument[],
  currency: string,
  limit = 20,
): ExpenseEntry[] {
  return docs
    .filter((doc) => doc.amount != null && doc.currency === currency)
    .map((doc) => ({
      id: doc.id,
      label: doc.correspondent ? `${doc.correspondent} — ${doc.title}` : doc.title,
      amount: doc.amount as number,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
}

export interface MissingReasonCount {
  reason: string
  count: number
}

const MISSING_REASON_LABELS: Record<string, string> = {
  correspondent: 'Missing correspondent',
  'document type': 'Missing document type',
  amount: 'Missing amount',
}

export function computeMissingReasons(docs: NormalizedDocument[]): MissingReasonCount[] {
  const counts = new Map<string, number>()
  for (const doc of docs) {
    for (const field of doc.missingFields) {
      counts.set(field, (counts.get(field) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([field, count]) => ({ reason: MISSING_REASON_LABELS[field] ?? field, count }))
    .sort((a, b) => b.count - a.count)
}
