import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import type { DocumentTag, NormalizedDocument } from '@/models/document'
import { isNumericDataType, type CustomFieldDef } from '@/parsing/customFields'

export function getColId(col: ColDef<NormalizedDocument>): string | undefined {
  return col.colId ?? (typeof col.field === 'string' ? col.field : undefined)
}

// AG Grid calls this from valueFormatter, getQuickFilterText, and
// filterValueGetter, and doesn't consistently pass the raw array in every
// case — sometimes it's already-formatted text from a prior pass. Handle
// both rather than relying on which one it happens to be.
export function tagsAsText(tags: DocumentTag[] | string | null | undefined): string {
  if (typeof tags === 'string') return tags
  return tags?.map((tag) => tag.name).join(', ') ?? ''
}

function TagsCellRenderer(params: ICellRendererParams<NormalizedDocument, DocumentTag[]>) {
  const tags = params.value ?? []
  if (tags.length === 0) return null
  return (
    <div className="flex h-full flex-wrap items-center gap-1 py-1">
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="rounded-full px-2 py-0.5 text-xs font-medium leading-none"
          style={{ backgroundColor: tag.color, color: tag.textColor }}
        >
          {tag.name}
        </span>
      ))}
    </div>
  )
}

function OpenLinkCellRenderer(params: ICellRendererParams<NormalizedDocument, string>) {
  if (!params.value) return null
  return (
    <a
      href={params.value}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-blue-600 underline underline-offset-2 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
    >
      Open ↗
    </a>
  )
}

// One column per custom field actually defined in Paperless — sorting/filtering
// operate on a type-appropriate raw value (number for monetary/integer/float,
// display text otherwise), while the cell always shows the parsed display text
// (e.g. "USD 25.11", "Yes"/"No", a resolved select option).
function customFieldColumn(def: CustomFieldDef): ColDef<NormalizedDocument> {
  const numeric = isNumericDataType(def.dataType)
  return {
    colId: `customField:${def.id}`,
    headerName: def.name,
    valueGetter: (params) => {
      const cf = params.data?.customFields.find((c) => c.fieldId === def.id)
      if (!cf) return null
      return numeric ? cf.numericValue : cf.display
    },
    cellRenderer: (params: ICellRendererParams<NormalizedDocument>) =>
      params.data?.customFields.find((c) => c.fieldId === def.id)?.display ?? '',
    filter: numeric ? 'agNumberColumnFilter' : 'agTextColumnFilter',
    type: numeric ? 'rightAligned' : undefined,
    minWidth: 140,
  }
}

export function buildDocumentColumnDefs(customFieldDefs: CustomFieldDef[]): ColDef<NormalizedDocument>[] {
  return [
    { field: 'createdDate', headerName: 'Date', sort: 'desc', filter: 'agDateColumnFilter', width: 130 },
    { field: 'title', headerName: 'Title', flex: 2, minWidth: 220 },
    { field: 'correspondent', headerName: 'Correspondent', flex: 1, minWidth: 160 },
    {
      field: 'tags',
      headerName: 'Tags',
      cellRenderer: TagsCellRenderer,
      // Explicit, rather than leaving AG Grid to infer one for CSV export /
      // quick filter — an inferred formatter for an array-of-objects column
      // was crashing (AG Grid warning #48) as soon as the quick filter ran.
      valueFormatter: (params) => tagsAsText(params.value),
      getQuickFilterText: (params) => tagsAsText(params.value),
      filter: 'agTextColumnFilter',
      filterValueGetter: (params) => tagsAsText(params.data?.tags),
      flex: 1,
      minWidth: 180,
    },
    { field: 'documentType', headerName: 'Document Type', flex: 1, minWidth: 150 },
    { field: 'storagePath', headerName: 'Storage Path', flex: 1, minWidth: 130 },
    { field: 'pageCount', headerName: 'Pages', width: 90 },
    { field: 'originalFileName', headerName: 'Original Filename', flex: 1, minWidth: 200 },
    // Custom fields vary per Paperless instance, so they go after the
    // metadata every user has, not sandwiched in the middle pushing
    // universal columns further right the more custom fields someone has.
    ...customFieldDefs.map(customFieldColumn),
    {
      field: 'paperlessUrl',
      headerName: '',
      cellRenderer: OpenLinkCellRenderer,
      sortable: false,
      filter: false,
      width: 90,
    },
  ]
}
