import { useState, type RefObject } from 'react'
import { X } from 'lucide-react'
import type { GridApi } from 'ag-grid-community'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { NormalizedDocument } from '@/models/document'
import { addSavedView, removeSavedView, type SavedView } from '@/grid/savedViews'

export type BuiltInViewId = 'all' | 'year' | 'last30' | 'missing-correspondent'

const BUILT_IN_VIEWS: { id: BuiltInViewId; label: string }[] = [
  { id: 'all', label: 'All documents' },
  { id: 'year', label: 'This year' },
  { id: 'last30', label: 'Last 30 days' },
  { id: 'missing-correspondent', label: 'Missing correspondent' },
]

export function ViewsMenu({
  gridApiRef,
  quickFilter,
  onQuickFilterChange,
  onBuiltInViewChange,
  savedViews,
  onSavedViewsChange,
}: {
  gridApiRef: RefObject<GridApi<NormalizedDocument> | null>
  quickFilter: string
  onQuickFilterChange: (text: string) => void
  onBuiltInViewChange: (id: BuiltInViewId) => void
  savedViews: SavedView[]
  onSavedViewsChange: (views: SavedView[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [newViewName, setNewViewName] = useState('')

  function applyBuiltIn(id: BuiltInViewId) {
    onBuiltInViewChange(id)
    onQuickFilterChange('')
    gridApiRef.current?.setFilterModel(null)
    gridApiRef.current?.applyColumnState({ defaultState: { sort: null } })
  }

  function applySavedView(view: SavedView) {
    onBuiltInViewChange('all')
    onQuickFilterChange(view.quickFilterText)
    gridApiRef.current?.setFilterModel(view.filterModel)
    gridApiRef.current?.applyColumnState({
      state: view.sortModel,
      defaultState: { sort: null },
    })
    setOpen(false)
  }

  function saveCurrentView() {
    const name = newViewName.trim()
    const api = gridApiRef.current
    if (!name || !api) return

    const filterModel = api.getFilterModel()
    const sortModel = api
      .getColumnState()
      .filter((state) => state.sort != null)
      .map((state) => ({ colId: state.colId, sort: state.sort as 'asc' | 'desc' }))

    const view: SavedView = {
      id: crypto.randomUUID(),
      name,
      filterModel,
      sortModel,
      quickFilterText: quickFilter,
    }
    onSavedViewsChange(addSavedView(view))
    setNewViewName('')
    setSaveDialogOpen(false)
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">Views</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Built-in</DropdownMenuLabel>
          {BUILT_IN_VIEWS.map((view) => (
            <DropdownMenuItem key={view.id} onSelect={() => applyBuiltIn(view.id)}>
              {view.label}
            </DropdownMenuItem>
          ))}
          {savedViews.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Saved views</DropdownMenuLabel>
              {savedViews.map((view) => (
                <div
                  key={view.id}
                  className="flex items-center gap-1 rounded-md px-1.5 py-1 text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <button
                    type="button"
                    className="flex-1 truncate text-left"
                    onClick={() => applySavedView(view)}
                  >
                    {view.name}
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete view ${view.name}`}
                    className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                    onClick={() => onSavedViewsChange(removeSavedView(view.id))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              setOpen(false)
              setSaveDialogOpen(true)
            }}
          >
            Save current view as…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save current view</DialogTitle>
            <DialogDescription>
              Saves the grid's active column filters, sort order, and search text as a
              reusable view you can switch back to later.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newViewName}
            onChange={(e) => setNewViewName(e.target.value)}
            placeholder="e.g. Tax receipts 2026"
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveCurrentView()
            }}
          />
          <DialogFooter>
            <Button onClick={saveCurrentView} disabled={!newViewName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
