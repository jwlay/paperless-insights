import type {
  Correspondent,
  CustomField,
  DocumentType,
  PaginatedResponse,
  PaperlessDocument,
  StoragePath,
  Tag,
} from './types'

export class PaperlessApiError extends Error {}

async function fetchPage<T>(url: string, token: string): Promise<PaginatedResponse<T>> {
  let res: Response
  try {
    res = await fetch(url, { headers: { Authorization: `Token ${token}` } })
  } catch (cause) {
    console.error(`Paperless request to ${url} failed before a response was received:`, cause)
    throw new PaperlessApiError(
      `Could not reach ${url} (${cause instanceof Error ? cause.message : String(cause)}).`,
    )
  }
  if (!res.ok) {
    throw new PaperlessApiError(`GET ${url} failed: ${res.status} ${res.statusText}`)
  }
  const text = await res.text()
  try {
    return JSON.parse(text) as PaginatedResponse<T>
  } catch (cause) {
    console.error(
      `Paperless response from ${url} was not valid JSON. Content-Type: ${res.headers.get('content-type')}. Body (first 500 chars):\n${text.slice(0, 500)}`,
      cause,
    )
    throw new PaperlessApiError(
      `Response from ${url} was not valid JSON (starts with: ${JSON.stringify(text.slice(0, 80))}).`,
    )
  }
}

async function fetchAllPages<T>(baseUrl: string, token: string, path: string): Promise<T[]> {
  const results: T[] = []
  let url: string | null = `${baseUrl}${path}`
  while (url) {
    const page: PaginatedResponse<T> = await fetchPage<T>(url, token)
    results.push(...page.results)
    url = page.next
  }
  return results
}

export function fetchDocuments(baseUrl: string, token: string) {
  return fetchAllPages<PaperlessDocument>(baseUrl, token, '/api/documents/?page_size=100')
}

export function fetchCorrespondents(baseUrl: string, token: string) {
  return fetchAllPages<Correspondent>(baseUrl, token, '/api/correspondents/?page_size=100')
}

export function fetchDocumentTypes(baseUrl: string, token: string) {
  return fetchAllPages<DocumentType>(baseUrl, token, '/api/document_types/?page_size=100')
}

export function fetchStoragePaths(baseUrl: string, token: string) {
  return fetchAllPages<StoragePath>(baseUrl, token, '/api/storage_paths/?page_size=100')
}

export function fetchTags(baseUrl: string, token: string) {
  return fetchAllPages<Tag>(baseUrl, token, '/api/tags/?page_size=100')
}

export function fetchCustomFields(baseUrl: string, token: string) {
  return fetchAllPages<CustomField>(baseUrl, token, '/api/custom_fields/?page_size=100')
}
