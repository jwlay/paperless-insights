import type { PaperlessDocument } from '@/api/types'
import { getAmountField, parseAmountValue } from '@/parsing/amount'

export interface DocumentTag {
  id: number
  name: string
  color: string
  textColor: string
}

export interface NormalizedDocument {
  id: number
  title: string
  createdDate: string | null
  correspondent: string | null
  documentType: string | null
  storagePath: string | null
  amount: number | null
  currency: string | null
  tags: DocumentTag[]
  pageCount: number | null
  originalFileName: string | null
  paperlessUrl: string
  hasMissingMetadata: boolean
  missingFields: string[]
}

export interface DocumentLookups {
  correspondents: Map<number, string>
  documentTypes: Map<number, string>
  storagePaths: Map<number, string>
  tags: Map<number, DocumentTag>
}

export function toNormalizedDocument(
  doc: PaperlessDocument,
  lookups: DocumentLookups,
  amountFieldId: number | null,
  baseUrl: string,
): NormalizedDocument {
  const missingFields: string[] = []

  const correspondent =
    doc.correspondent !== null ? (lookups.correspondents.get(doc.correspondent) ?? null) : null
  if (doc.correspondent === null) missingFields.push('correspondent')

  const documentType =
    doc.document_type !== null ? (lookups.documentTypes.get(doc.document_type) ?? null) : null
  if (doc.document_type === null) missingFields.push('document type')

  const storagePath =
    doc.storage_path !== null ? (lookups.storagePaths.get(doc.storage_path) ?? null) : null

  const amountField = getAmountField(doc.custom_fields, amountFieldId)
  let amount: number | null = null
  let currency: string | null = null
  if (amountField) {
    const parsed = parseAmountValue(amountField.value)
    if (parsed) {
      amount = parsed.amount
      currency = parsed.currency
    } else {
      missingFields.push('amount')
    }
  }

  const tags = doc.tags
    .map((id) => lookups.tags.get(id))
    .filter((tag): tag is DocumentTag => Boolean(tag))

  return {
    id: doc.id,
    title: doc.title,
    createdDate: doc.created,
    correspondent,
    documentType,
    storagePath,
    amount,
    currency,
    tags,
    pageCount: doc.page_count,
    originalFileName: doc.original_file_name,
    paperlessUrl: `${baseUrl}/documents/${doc.id}/details`,
    hasMissingMetadata: missingFields.length > 0,
    missingFields,
  }
}
