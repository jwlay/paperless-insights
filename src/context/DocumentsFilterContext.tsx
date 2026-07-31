import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { NormalizedDocument } from '@/models/document'

interface DocumentsFilterContextValue {
  // null until the Documents grid has published at least once (e.g. before it's
  // ever been visited). Dashboards should fall back to the full document set.
  filteredDocuments: NormalizedDocument[] | null
  setFilteredDocuments: (docs: NormalizedDocument[]) => void
}

const DocumentsFilterContext = createContext<DocumentsFilterContextValue | null>(null)

export function DocumentsFilterProvider({ children }: { children: ReactNode }) {
  const [filteredDocuments, setFilteredDocuments] = useState<NormalizedDocument[] | null>(null)
  const value = useMemo(() => ({ filteredDocuments, setFilteredDocuments }), [filteredDocuments])
  return <DocumentsFilterContext.Provider value={value}>{children}</DocumentsFilterContext.Provider>
}

export function useDocumentsFilter() {
  const ctx = useContext(DocumentsFilterContext)
  if (!ctx) throw new Error('useDocumentsFilter must be used within DocumentsFilterProvider')
  return ctx
}
