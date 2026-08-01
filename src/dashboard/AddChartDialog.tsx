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
  return kind === 'builtin'
    ? { kind: 'builtin', key: rest as BuiltinDimensionKey }
    : { kind: 'customField', fieldId: Number(rest) }
}

function metricKey(m: Metric): string {
  return m.kind === 'count' ? 'count' : `sum:${m.fieldId}`
}

function dimensionLabel(d: Dimension, customFieldDefs: CustomFieldDef[]): string {
  if (d.kind === 'builtin') return BUILTIN_DIMENSIONS.find((b) => b.key === d.key)?.label ?? d.key
  return customFieldDefs.find((f) => f.id === d.fieldId)?.name ?? 'custom field'
}

function DimensionSelect({
  label,
  helpText,
  value,
  onChange,
  customFieldDefs,
}: {
  label: string
  helpText: string
  value: Dimension
  onChange: (d: Dimension) => void
  customFieldDefs: CustomFieldDef[]
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">{helpText}</p>
      <Select value={dimensionKey(value)} onValueChange={(v) => onChange(parseDimensionKey(v))}>
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
  )
}

export function AddChartDialog({
  open,
  onOpenChange,
  onSave,
  customFieldDefs,
  docs,
  editingConfig,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (config: ChartConfig) => void
  customFieldDefs: CustomFieldDef[]
  docs: NormalizedDocument[]
  editingConfig?: ChartConfig | null
}) {
  const palette = getPalette(useIsDarkMode())
  const isEditing = editingConfig != null

  const numericFields = useMemo(
    () => customFieldDefs.filter((f) => isNumericDataType(f.dataType)),
    [customFieldDefs],
  )
  const monetaryFields = useMemo(
    () => customFieldDefs.filter((f) => f.dataType === 'monetary'),
    [customFieldDefs],
  )

  const [kind, setKind] = useState<ChartConfig['kind']>(editingConfig?.kind ?? 'grouped')
  const [dimension, setDimension] = useState<Dimension>(
    editingConfig?.kind === 'grouped'
      ? editingConfig.dimension
      : editingConfig?.kind === 'stacked-bar'
        ? editingConfig.primary
        : { kind: 'builtin', key: 'correspondent' },
  )
  const [stackDimension, setStackDimension] = useState<Dimension>(
    editingConfig?.kind === 'stacked-bar' ? editingConfig.stack : { kind: 'builtin', key: 'year' },
  )
  const [metric, setMetric] = useState<Metric>(
    editingConfig?.kind === 'grouped' || editingConfig?.kind === 'stacked-bar'
      ? editingConfig.metric
      : { kind: 'count' },
  )
  const [currency, setCurrency] = useState<string | null>(
    (editingConfig?.kind === 'grouped' || editingConfig?.kind === 'stacked-bar') &&
      editingConfig.metric.kind === 'sum'
      ? editingConfig.metric.currency
      : editingConfig?.kind === 'largest-values'
        ? editingConfig.currency
        : null,
  )
  const [visual, setVisual] = useState<ChartVisual>(
    editingConfig?.kind === 'grouped' ? editingConfig.visual : 'bar',
  )
  const [valueFieldId, setValueFieldId] = useState<number | null>(
    editingConfig?.kind === 'largest-values' || editingConfig?.kind === 'currency-distribution'
      ? editingConfig.fieldId
      : (monetaryFields[0]?.id ?? numericFields[0]?.id ?? null),
  )
  const [calendarField, setCalendarField] = useState<'added' | 'created'>(
    editingConfig?.kind === 'activity-calendar' ? editingConfig.field : 'added',
  )
  const [title, setTitle] = useState(editingConfig?.title ?? '')
  const [titleTouched, setTitleTouched] = useState(isEditing)

  const activeMonetaryFieldId =
    (kind === 'grouped' || kind === 'stacked-bar') && metric.kind === 'sum'
      ? metric.fieldId
      : kind === 'largest-values'
        ? valueFieldId
        : null
  const activeField = customFieldDefs.find((f) => f.id === activeMonetaryFieldId)
  const currenciesForActiveField = useMemo(() => {
    if (!activeField || activeField.dataType !== 'monetary') return []
    const set = new Set<string>()
    for (const doc of docs) {
      const cf = doc.customFields.find((c) => c.fieldId === activeField.id)
      if (cf?.currency) set.add(cf.currency)
    }
    return [...set].sort()
  }, [activeField, docs])
  const showCurrencyPicker = Boolean(activeField) && currenciesForActiveField.length > 0

  const suggestedTitle = (() => {
    switch (kind) {
      case 'grouped': {
        const dimLabel = dimensionLabel(dimension, customFieldDefs)
        if (metric.kind === 'count') return `Documents by ${dimLabel.toLowerCase()}`
        const fieldName = customFieldDefs.find((f) => f.id === metric.fieldId)?.name ?? 'value'
        return `${fieldName} by ${dimLabel.toLowerCase()}${currency ? ` (${currency})` : ''}`
      }
      case 'stacked-bar': {
        const primaryLabel = dimensionLabel(dimension, customFieldDefs)
        const stackLabel = dimensionLabel(stackDimension, customFieldDefs)
        const measured =
          metric.kind === 'count'
            ? 'Documents'
            : (customFieldDefs.find((f) => f.id === metric.fieldId)?.name ?? 'Value')
        return `${measured} by ${primaryLabel.toLowerCase()}, stacked by ${stackLabel.toLowerCase()}`
      }
      case 'activity-calendar':
        return `Activity calendar (${calendarField === 'added' ? 'date added' : 'document date'})`
      case 'largest-values': {
        const f = customFieldDefs.find((x) => x.id === valueFieldId)
        return `Largest ${f?.name ?? 'values'}${currency ? ` (${currency})` : ''}`
      }
      case 'currency-distribution': {
        const f = customFieldDefs.find((x) => x.id === valueFieldId)
        return `${f?.name ?? 'Amount'} currency distribution`
      }
      case 'missing-fields':
        return 'Missing metadata'
      case 'added-over-time':
        return 'Documents added over time'
    }
  })()

  const effectiveTitle = titleTouched ? title : suggestedTitle

  const previewSentence = (() => {
    switch (kind) {
      case 'grouped': {
        const dimLabel = dimensionLabel(dimension, customFieldDefs)
        const shape = visual === 'pie' ? 'slice' : visual === 'line' ? 'point' : 'bar'
        const measured =
          metric.kind === 'count'
            ? 'the number of documents'
            : `the sum of "${customFieldDefs.find((f) => f.id === metric.fieldId)?.name}"${currency ? ` in ${currency}` : ''}`
        return `Each ${shape} is one ${dimLabel.toLowerCase()}; its size is ${measured}.`
      }
      case 'stacked-bar': {
        const primaryLabel = dimensionLabel(dimension, customFieldDefs)
        const stackLabel = dimensionLabel(stackDimension, customFieldDefs)
        const measured =
          metric.kind === 'count'
            ? 'number of documents'
            : `sum of "${customFieldDefs.find((f) => f.id === metric.fieldId)?.name}"${currency ? ` in ${currency}` : ''}`
        return `Each bar is one ${primaryLabel.toLowerCase()}, split into segments by ${stackLabel.toLowerCase()} (top 3 + Other); segment size is the ${measured}.`
      }
      case 'activity-calendar':
        return `One cell per day over the last year, colored by how many documents were ${calendarField === 'added' ? 'added to Paperless' : 'dated'} that day.`
      case 'largest-values': {
        const f = customFieldDefs.find((x) => x.id === valueFieldId)
        return `Ranks individual documents by "${f?.name ?? ''}"${currency ? ` in ${currency}` : ''}, largest first.`
      }
      case 'currency-distribution': {
        const f = customFieldDefs.find((x) => x.id === valueFieldId)
        return `Shows how many documents have a value for "${f?.name ?? ''}" in each currency.`
      }
      case 'missing-fields':
        return 'Counts documents missing a correspondent, document type, or any custom field value.'
      case 'added-over-time':
        return 'Document counts per month, based on when each document was added to Paperless.'
    }
  })()

  const draftConfig: ChartConfig = useMemo(() => {
    const id = editingConfig?.id ?? 'preview'
    const resolvedMetric: Metric = metric.kind === 'sum' ? { ...metric, currency } : metric
    switch (kind) {
      case 'stacked-bar':
        return {
          id,
          title: effectiveTitle,
          kind: 'stacked-bar',
          primary: dimension,
          stack: stackDimension,
          metric: resolvedMetric,
        }
      case 'activity-calendar':
        return { id, title: effectiveTitle, kind: 'activity-calendar', field: calendarField }
      case 'largest-values':
        return {
          id,
          title: effectiveTitle,
          kind: 'largest-values',
          fieldId: valueFieldId ?? 0,
          currency,
        }
      case 'currency-distribution':
        return { id, title: effectiveTitle, kind: 'currency-distribution', fieldId: valueFieldId ?? 0 }
      case 'missing-fields':
        return { id, title: effectiveTitle, kind: 'missing-fields' }
      case 'added-over-time':
        return { id, title: effectiveTitle, kind: 'added-over-time' }
      default:
        return {
          id,
          title: effectiveTitle,
          kind: 'grouped',
          dimension,
          metric: resolvedMetric,
          visual,
          limit: 10,
        }
    }
  }, [
    kind,
    dimension,
    stackDimension,
    metric,
    currency,
    visual,
    calendarField,
    valueFieldId,
    effectiveTitle,
    editingConfig,
  ])

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

  function handleSave() {
    onSave(isEditing ? draftConfig : { ...draftConfig, id: crypto.randomUUID() })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit chart' : 'Add chart'}</DialogTitle>
          <DialogDescription>
            Every chart groups documents by one field, then measures each group by a count or a
            sum.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label>Chart type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as ChartConfig['kind'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grouped">Grouped (one field)</SelectItem>
                <SelectItem value="stacked-bar">Stacked bar (two fields)</SelectItem>
                <SelectItem value="activity-calendar">Activity calendar</SelectItem>
                {numericFields.length > 0 && (
                  <SelectItem value="largest-values">Largest individual values</SelectItem>
                )}
                {monetaryFields.length > 0 && (
                  <SelectItem value="currency-distribution">Currency distribution</SelectItem>
                )}
                <SelectItem value="missing-fields">Missing metadata breakdown</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {kind === 'grouped' && (
            <DimensionSelect
              label="Group by"
              helpText="Which field splits documents into bars/slices/points."
              value={dimension}
              onChange={setDimension}
              customFieldDefs={customFieldDefs}
            />
          )}

          {kind === 'stacked-bar' && (
            <>
              <DimensionSelect
                label="Group by (bars)"
                helpText="One bar per value of this field."
                value={dimension}
                onChange={setDimension}
                customFieldDefs={customFieldDefs}
              />
              <DimensionSelect
                label="Stack by (segments)"
                helpText="Each bar is split into colored segments by this field (top 3 + Other)."
                value={stackDimension}
                onChange={setStackDimension}
                customFieldDefs={customFieldDefs}
              />
            </>
          )}

          {(kind === 'grouped' || kind === 'stacked-bar') && (
            <div className="space-y-1.5">
              <Label>Measure</Label>
              <p className="text-xs text-muted-foreground">
                What each bar/slice/segment's size means.
              </p>
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
          )}

          {(kind === 'largest-values' || kind === 'currency-distribution') && (
            <div className="space-y-1.5">
              <Label>Field</Label>
              <Select
                value={valueFieldId != null ? String(valueFieldId) : undefined}
                onValueChange={(v) => setValueFieldId(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(kind === 'currency-distribution' ? monetaryFields : numericFields).map((f) => (
                    <SelectItem key={f.id} value={String(f.id)}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {kind === 'activity-calendar' && (
            <div className="space-y-1.5">
              <Label>Date field</Label>
              <Select
                value={calendarField}
                onValueChange={(v) => setCalendarField(v as 'added' | 'created')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="added">Date added to Paperless</SelectItem>
                  <SelectItem value="created">Document's own date</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {showCurrencyPicker && (
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <p className="text-xs text-muted-foreground">
                "{activeField?.name}" has values in more than one currency — pick one (mixing
                currencies can't be added together meaningfully).
              </p>
              <Select value={currency ?? currenciesForActiveField[0]} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currenciesForActiveField.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {kind === 'grouped' && (
            <div className="space-y-1.5">
              <Label>Visual</Label>
              <Select value={visual} onValueChange={(v) => setVisual(v as ChartVisual)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">Bar — best for ranking categories</SelectItem>
                  <SelectItem value="line">Line — best for a trend over year/month</SelectItem>
                  <SelectItem value="pie">
                    Pie — best for a few categories' share of the whole
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            {previewSentence}
          </div>

          <div className="space-y-1.5">
            <Label>Preview</Label>
            <div className="rounded-md border bg-card p-2">
              {previewOption ? (
                <EChart option={previewOption} height={220} />
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
          <Button onClick={handleSave}>{isEditing ? 'Save changes' : 'Add chart'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
