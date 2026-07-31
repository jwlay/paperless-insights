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
