import type { ColDef } from 'ag-grid-community'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { NormalizedDocument } from '@/models/document'

export function ColumnVisibilityMenu({
  columnDefs,
  hiddenFields,
  onToggle,
}: {
  columnDefs: ColDef<NormalizedDocument>[]
  hiddenFields: Set<string>
  onToggle: (field: string, visible: boolean) => void
}) {
  const toggleable = columnDefs.filter((col) => col.field && col.headerName)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Columns</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {toggleable.map((col) => {
          const field = col.field as string
          return (
            <DropdownMenuCheckboxItem
              key={field}
              checked={!hiddenFields.has(field)}
              onCheckedChange={(checked) => onToggle(field, checked)}
              onSelect={(e) => e.preventDefault()}
            >
              {col.headerName}
            </DropdownMenuCheckboxItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
