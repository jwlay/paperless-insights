import type { ColDef } from 'ag-grid-community'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { NormalizedDocument } from '@/models/document'
import { getColId } from '@/grid/columns'

export function ColumnVisibilityMenu({
  columnDefs,
  hiddenFields,
  onToggle,
}: {
  columnDefs: ColDef<NormalizedDocument>[]
  hiddenFields: Set<string>
  onToggle: (colId: string, visible: boolean) => void
}) {
  const toggleable = columnDefs
    .map((col) => ({ col, colId: getColId(col) }))
    .filter((entry): entry is { col: ColDef<NormalizedDocument>; colId: string } =>
      Boolean(entry.colId && entry.col.headerName),
    )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Columns</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-96 overflow-y-auto">
        {toggleable.map(({ col, colId }) => (
          <DropdownMenuCheckboxItem
            key={colId}
            checked={!hiddenFields.has(colId)}
            onCheckedChange={(checked) => onToggle(colId, checked)}
            onSelect={(e) => e.preventDefault()}
          >
            {col.headerName}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
