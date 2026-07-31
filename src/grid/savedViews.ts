export interface SavedView {
  id: string
  name: string
  filterModel: Record<string, unknown>
  sortModel: { colId: string; sort: 'asc' | 'desc' }[]
  quickFilterText: string
}

const STORAGE_KEY = 'paperless-insights:saved-views'

export function getSavedViews(): SavedView[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SavedView[]) : []
  } catch {
    return []
  }
}

export function addSavedView(view: SavedView): SavedView[] {
  const views = [...getSavedViews(), view]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(views))
  return views
}

export function removeSavedView(id: string): SavedView[] {
  const views = getSavedViews().filter((view) => view.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(views))
  return views
}
