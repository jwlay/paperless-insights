import { describe, expect, it } from 'vitest'
import {
  computeDailyActivity,
  computeDuplicateDocuments,
  computeRecentDocuments,
  computeStackedGroups,
} from './aggregate'
import type { NormalizedDocument } from '@/models/document'

function doc(overrides: Partial<NormalizedDocument>): NormalizedDocument {
  return {
    id: 1,
    title: 'Doc',
    createdDate: '2026-01-01',
    addedDate: '2026-01-01T00:00:00Z',
    modifiedDate: '2026-01-01T00:00:00Z',
    correspondent: null,
    documentType: null,
    storagePath: null,
    tags: [],
    pageCount: 1,
    originalFileName: 'doc.pdf',
    paperlessUrl: 'https://paperless.example.com/documents/1/details',
    hasMissingMetadata: false,
    missingFields: [],
    customFields: [],
    duplicateDocumentIds: [],
    ...overrides,
  }
}

describe('computeStackedGroups', () => {
  const docs: NormalizedDocument[] = [
    doc({ id: 1, correspondent: 'Acme', createdDate: '2026-01-15' }),
    doc({ id: 2, correspondent: 'Acme', createdDate: '2025-01-15' }),
    doc({ id: 3, correspondent: 'Beta', createdDate: '2026-01-15' }),
    doc({ id: 4, correspondent: 'Gamma', createdDate: '2026-01-15' }),
    doc({ id: 5, correspondent: 'Delta', createdDate: '2026-01-15' }),
    doc({ id: 6, correspondent: 'Epsilon', createdDate: '2026-01-15' }),
  ]

  it('groups by primary dimension and stacks by the second, by count', () => {
    const result = computeStackedGroups(
      docs,
      { kind: 'builtin', key: 'correspondent' },
      { kind: 'builtin', key: 'year' },
    )
    expect(result.categories).toContain('Acme')
    const acmeIndex = result.categories.indexOf('Acme')
    const totalForAcme = result.series.reduce((sum, s) => sum + s.data[acmeIndex], 0)
    expect(totalForAcme).toBe(2)
  })

  it('folds the stack dimension to top 3 + Other', () => {
    // Five distinct correspondents as the STACK dimension this time, one document each.
    const manyStacks: NormalizedDocument[] = [
      doc({ id: 1, correspondent: 'A', documentType: 'Invoice' }),
      doc({ id: 2, correspondent: 'B', documentType: 'Invoice' }),
      doc({ id: 3, correspondent: 'C', documentType: 'Invoice' }),
      doc({ id: 4, correspondent: 'D', documentType: 'Invoice' }),
      doc({ id: 5, correspondent: 'E', documentType: 'Invoice' }),
    ]
    const result = computeStackedGroups(
      manyStacks,
      { kind: 'builtin', key: 'documentType' },
      { kind: 'builtin', key: 'correspondent' },
    )
    expect(result.series.length).toBe(4) // top 3 correspondents + "Other"
    expect(result.series.some((s) => s.name === 'Other')).toBe(true)
  })
})

describe('computeDailyActivity', () => {
  it('counts documents per calendar day', () => {
    const docs = [
      doc({ id: 1, addedDate: '2026-02-01T10:00:00Z' }),
      doc({ id: 2, addedDate: '2026-02-01T18:00:00Z' }),
      doc({ id: 3, addedDate: '2026-02-02T09:00:00Z' }),
    ]
    const result = computeDailyActivity(docs, 'added')
    expect(result).toEqual([
      { date: '2026-02-01', count: 2 },
      { date: '2026-02-02', count: 1 },
    ])
  })
})

describe('computeRecentDocuments', () => {
  it('sorts newest first and respects the limit', () => {
    const docs = [
      doc({ id: 1, addedDate: '2026-01-01T00:00:00Z' }),
      doc({ id: 2, addedDate: '2026-03-01T00:00:00Z' }),
      doc({ id: 3, addedDate: '2026-02-01T00:00:00Z' }),
    ]
    const result = computeRecentDocuments(docs, 'addedDate', 2)
    expect(result.map((d) => d.id)).toEqual([2, 3])
  })
})

describe('computeDuplicateDocuments', () => {
  it('returns only documents Paperless flagged as having duplicates', () => {
    const docs = [
      doc({ id: 1, duplicateDocumentIds: [] }),
      doc({ id: 2, duplicateDocumentIds: [3] }),
    ]
    expect(computeDuplicateDocuments(docs).map((d) => d.id)).toEqual([2])
  })
})
