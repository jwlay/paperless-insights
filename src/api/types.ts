export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface DocumentCustomFieldValue {
  value: string | null
  field: number
}

export interface DocumentVersion {
  id: number
  added: string
  version_label: string | null
  checksum: string
  is_root: boolean
}

export interface PaperlessDocument {
  id: number
  correspondent: number | null
  document_type: number | null
  storage_path: number | null
  title: string
  content: string
  tags: number[]
  created: string
  created_date: string
  modified: string
  added: string
  deleted_at: string | null
  archive_serial_number: number | null
  original_file_name: string | null
  archived_file_name: string | null
  duplicate_documents: number[]
  owner: number | null
  user_can_change: boolean
  is_shared_by_requester: boolean
  notes: unknown[]
  custom_fields: DocumentCustomFieldValue[]
  page_count: number | null
  mime_type: string
  root_document: number | null
  versions: DocumentVersion[]
}

export interface NamedObject {
  id: number
  slug: string
  name: string
  match: string
  matching_algorithm: number
  is_insensitive: boolean
  document_count: number
  owner: number | null
  user_can_change: boolean
}

export type Correspondent = NamedObject
export type DocumentType = NamedObject

export interface StoragePath extends NamedObject {
  path: string
}

export interface Tag extends NamedObject {
  color: string
  text_color: string
  is_inbox_tag: boolean
  parent: number | null
  children: number[]
}

export interface CustomField {
  id: number
  name: string
  data_type: string
  extra_data: {
    select_options: string[]
    default_currency: string | null
  }
  document_count: number
}
