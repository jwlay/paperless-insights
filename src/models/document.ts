import type { PaperlessDocument } from '@/api/types'
import { parseCustomFieldValue, type CustomFieldDef, type ParsedCustomFieldValue } from '@/parsing/customFields'

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
  addedDate: string | null
  correspondent: string | null
  documentType: string | null
  storagePath: string | null
  tags: DocumentTag[]
  pageCount: number | null
  originalFileName: string | null
  paperlessUrl: string
  hasMissingMetadata: boolean
  missingFields: string[]
  customFields: ParsedCustomFieldValue[]
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
  customFieldDefs: CustomFieldDef[],
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

  const rawByField = new Map(doc.custom_fields.map((cf) => [cf.field, cf.value]))
  const customFields = customFieldDefs.map((def) =>
    parseCustomFieldValue(def, rawByField.get(def.id)),
  )

  const tags = doc.tags
    .map((id) => lookups.tags.get(id))
    .filter((tag): tag is DocumentTag => Boolean(tag))

  return {
    id: doc.id,
    title: doc.title,
    createdDate: doc.created,
    addedDate: doc.added,
    correspondent,
    documentType,
    storagePath,
    tags,
    pageCount: doc.page_count,
    originalFileName: doc.original_file_name,
    paperlessUrl: `${baseUrl}/documents/${doc.id}/details`,
    hasMissingMetadata: missingFields.length > 0,
    missingFields,
    customFields,
  }
}
