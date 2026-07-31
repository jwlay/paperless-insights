import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { NormalizedDocument } from '@/models/document'
import { isNumericDataType, type CustomFieldDef } from '@/parsing/customFields'
import type { BuiltinDimensionKey, Dimension } from './aggregate'
import type { ChartConfig, ChartVisual, Metric } from './chartConfig'
import { buildChartOption } from './chartOptions'
import { getPalette } from './colors'
import { EChart } from './EChart'
import { useIsDarkMode } from '@/lib/theme'

const previewAmountFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const previewCountFormatter = new Intl.NumberFormat(undefined)

const BUILTIN_DIMENSIONS: { key: BuiltinDimensionKey; label: string }[] = [
  { key: 'correspondent', label: 'Correspondent' },
  { key: 'tag', label: 'Tag' },
  { key: 'documentType', label: 'Document type' },
  { key: 'storagePath', label: 'Storage path' },
  { key: 'year', label: 'Year' },
  { key: 'month', label: 'Month' },
]

// "dim:builtin:correspondent" / "dim:field:14" — a flat string key so a single
// Select can list both kinds of options.
function dimensionKey(d: Dimension): string {
  return d.kind === 'builtin' ? `builtin:${d.key}` : `field:${d.fieldId}`
}
function parseDimensionKey(key: string): Dimension {
  const [kind, rest] = key.split(':') as ['builtin' | 'field', string]
  return kind === 'builtin' ? { kind: 'builtin', key: rest as BuiltinDimensionKey } : { kind: 'customField', fieldId: Number(rest) }
}

function metricKey(m: Metric): string {
  return m.kind === 'count' ? 'count' : `sum:${m.fieldId}`
}

function dimensionLabel(d: Dimension, customFieldDefs: CustomFieldDef[]): string {
  if (d.kind === 'builtin') return BUILTIN_DIMENSIONS.find((b) => b.key === d.key)?.label ?? d.key
  return customFieldDefs.find((f) => f.id === d.fieldId)?.name ?? 'custom field'
}

export function AddChartDialog({
  open,
  onOpenChange,
  onAdd,
  customFieldDefs,
  docs,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (config: ChartConfig) => void
  customFieldDefs: CustomFieldDef[]
  docs: NormalizedDocument[]
}) {
  const palette = getPalette(useIsDarkMode())

  const numericFields = useMemo(
    () => customFieldDefs.filter((f) => isNumericDataType(f.dataType)),
    [customFieldDefs],
  )

  const [dimension, setDimension] = useState<Dimension>({ kind: 'builtin', key: 'correspondent' })
  const [metric, setMetric] = useState<Metric>({ kind: 'count' })
  const [currency, setCurrency] = useState<string | null>(null)
  const [visual, setVisual] = useState<ChartVisual>('bar')
  const [title, setTitle] = useState('')
  const [titleTouched, setTitleTouched] = useState(false)

  const sumField =
    metric.kind === 'sum' ? customFieldDefs.find((f) => f.id === metric.fieldId) : undefined
  const currenciesForSumField = useMemo(() => {
    if (!sumField || sumField.dataType !== 'monetary') return []
    const set = new Set<string>()
    for (const doc of docs) {
      const cf = doc.customFields.find((c) => c.fieldId === sumField.id)
      if (cf?.currency) set.add(cf.currency)
    }
    return [...set].sort()
  }, [sumField, docs])

  const suggestedTitle = (() => {
    const dimLabel = dimensionLabel(dimension, customFieldDefs)
    if (metric.kind === 'count') return `Documents by ${dimLabel.toLowerCase()}`
    const fieldName = customFieldDefs.find((f) => f.id === metric.fieldId)?.name ?? 'value'
    return `${fieldName} by ${dimLabel.toLowerCase()}${currency ? ` (${currency})` : ''}`
  })()

  const effectiveTitle = titleTouched ? title : suggestedTitle

  const previewSentence = (() => {
    const dimLabel = dimensionLabel(dimension, customFieldDefs)
    const shape =
      visual === 'pie'
        ? 'slices'
        : visual === 'line'
          ? 'points'
          : 'bars'
    const measured =
      metric.kind === 'count'
        ? 'the number of documents'
        : `the sum of "${customFieldDefs.find((f) => f.id === metric.fieldId)?.name}"${currency ? ` in ${currency}` : ''}`
    return `Each ${shape.slice(0, -1)} is one ${dimLabel.toLowerCase()}; its size is ${measured}.`
  })()

  const draftConfig: ChartConfig = useMemo(
    () => ({
      id: 'preview',
      title: effectiveTitle,
      kind: 'grouped',
      dimension,
      metric: metric.kind === 'sum' ? { ...metric, currency } : metric,
      visual,
      limit: 10,
    }),
    [dimension, metric, currency, visual, effectiveTitle],
  )

  const previewOption = useMemo(
    () =>
      buildChartOption(
        draftConfig,
        docs,
        customFieldDefs,
        (v) => previewAmountFormatter.format(v),
        (v) => previewCountFormatter.format(v),
        palette,
      ),
    [draftConfig, docs, customFieldDefs, palette],
  )

  function handleAdd() {
    const id = crypto.randomUUID()
    onAdd({ ...draftConfig, id })
    onOpenChange(false)
    setTitleTouched(false)
    setTitle('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add chart</DialogTitle>
          <DialogDescription>
            Every chart groups documents by one field, then measures each group by a count or a
            sum.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Group by</Label>
            <p className="text-xs text-muted-foreground">
              Which field splits documents into bars/slices/points.
            </p>
            <Select
              value={dimensionKey(dimension)}
              onValueChange={(v) => setDimension(parseDimensionKey(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BUILTIN_DIMENSIONS.map((d) => (
                  <SelectItem key={d.key} value={`builtin:${d.key}`}>
                    {d.label}
                  </SelectItem>
                ))}
                {customFieldDefs.map((f) => (
                  <SelectItem key={f.id} value={`field:${f.id}`}>
                    {f.name} ({f.dataType})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Measure</Label>
            <p className="text-xs text-muted-foreground">What each bar/slice/point's size means.</p>
            <Select
              value={metricKey(metric)}
              onValueChange={(v) => {
                if (v === 'count') {
                  setMetric({ kind: 'count' })
                  setCurrency(null)
                } else {
                  const fieldId = Number(v.split(':')[1])
                  setMetric({ kind: 'sum', fieldId, currency: null })
                  setCurrency(null)
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="count">Number of documents</SelectItem>
                {numericFields.map((f) => (
                  <SelectItem key={f.id} value={`sum:${f.id}`}>
                    Sum of {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {sumField?.dataType === 'monetary' && currenciesForSumField.length > 0 && (
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <p className="text-xs text-muted-foreground">
                "{sumField.name}" has values in more than one currency — pick one to sum (mixing
                currencies can't be added together meaningfully).
              </p>
              <Select value={currency ?? currenciesForSumField[0]} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currenciesForSumField.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Visual</Label>
            <Select value={visual} onValueChange={(v) => setVisual(v as ChartVisual)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">Bar — best for ranking categories</SelectItem>
                <SelectItem value="line">Line — best for a trend over year/month</SelectItem>
                <SelectItem value="pie">Pie — best for a few categories' share of the whole</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            {previewSentence}
          </div>

          <div className="space-y-1.5">
            <Label>Preview</Label>
            <div className="rounded-md border bg-card p-2">
              {previewOption ? (
                <EChart option={previewOption} height={200} />
              ) : (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  No data to preview yet — try a different field or measure.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              value={effectiveTitle}
              onChange={(e) => {
                setTitle(e.target.value)
                setTitleTouched(true)
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleAdd}>Add chart</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
