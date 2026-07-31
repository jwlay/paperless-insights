import type { ColDef, ICellRendererParams, ValueFormatterParams } from 'ag-grid-community'
import type { DocumentTag, NormalizedDocument } from '@/models/document'

const numberFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function amountFormatter(params: ValueFormatterParams<NormalizedDocument, number | null>) {
  if (params.value == null) return ''
  const formatted = numberFormatter.format(params.value)
  return params.data?.currency ? `${params.data.currency} ${formatted}` : formatted
}

function tagsAsText(tags: DocumentTag[] | undefined) {
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
      className="font-medium text-primary underline underline-offset-2"
    >
      Open ↗
    </a>
  )
}

export const documentColumnDefs: ColDef<NormalizedDocument>[] = [
  { field: 'createdDate', headerName: 'Date', sort: 'desc', filter: 'agDateColumnFilter', width: 130 },
  { field: 'title', headerName: 'Title', flex: 2, minWidth: 220 },
  { field: 'correspondent', headerName: 'Correspondent', flex: 1, minWidth: 160 },
  {
    field: 'amount',
    headerName: 'Amount',
    valueFormatter: amountFormatter,
    type: 'rightAligned',
    width: 140,
  },
  { field: 'currency', headerName: 'Currency', width: 100 },
  {
    field: 'tags',
    headerName: 'Tags',
    cellRenderer: TagsCellRenderer,
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
  {
    field: 'paperlessUrl',
    headerName: '',
    cellRenderer: OpenLinkCellRenderer,
    sortable: false,
    filter: false,
    width: 90,
  },
]
