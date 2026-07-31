import { useQuery } from '@tanstack/react-query'
import { getPaperlessConfig } from '@/lib/paperless-config'
import { findAmountFieldId } from '@/parsing/amount'
import { toNormalizedDocument, type DocumentTag, type NormalizedDocument } from '@/models/document'
import type { Tag } from './types'
import {
  fetchCorrespondents,
  fetchCustomFields,
  fetchDocumentTypes,
  fetchDocuments,
  fetchStoragePaths,
  fetchTags,
} from './client'

function toNameMap(items: { id: number; name: string }[]) {
  return new Map(items.map((item) => [item.id, item.name]))
}

function toTagMap(tags: Tag[]): Map<number, DocumentTag> {
  return new Map(
    tags.map((tag) => [
      tag.id,
      { id: tag.id, name: tag.name, color: tag.color, textColor: tag.text_color },
    ]),
  )
}

export function useDocuments() {
  const config = getPaperlessConfig()

  return useQuery({
    queryKey: ['paperless-documents', config?.baseUrl],
    enabled: config !== null,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<NormalizedDocument[]> => {
      if (!config) throw new Error('Not connected to Paperless.')
      const { baseUrl, token } = config

      const [documents, correspondents, documentTypes, storagePaths, tags, customFields] =
        await Promise.all([
          fetchDocuments(baseUrl, token),
          fetchCorrespondents(baseUrl, token),
          fetchDocumentTypes(baseUrl, token),
          fetchStoragePaths(baseUrl, token),
          fetchTags(baseUrl, token),
          fetchCustomFields(baseUrl, token),
        ])

      const amountFieldId = findAmountFieldId(customFields)
      const lookups = {
        correspondents: toNameMap(correspondents),
        documentTypes: toNameMap(documentTypes),
        storagePaths: toNameMap(storagePaths),
        tags: toTagMap(tags),
      }

      return documents.map((doc) => toNormalizedDocument(doc, lookups, amountFieldId, baseUrl))
    },
  })
}
