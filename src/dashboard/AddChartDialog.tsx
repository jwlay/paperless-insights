import { useState } from 'react'
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
import type { GroupByDimension } from './aggregate'
import type { ChartConfig, ChartMetric, ChartVisual } from './chartConfig'

const DIMENSIONS: { id: GroupByDimension; label: string }[] = [
  { id: 'correspondent', label: 'Correspondent' },
  { id: 'tag', label: 'Tag' },
  { id: 'documentType', label: 'Document type' },
  { id: 'storagePath', label: 'Storage path' },
  { id: 'currency', label: 'Currency' },
  { id: 'year', label: 'Year' },
  { id: 'month', label: 'Month' },
]

type SpecialKind = 'largest-expenses' | 'added-over-time' | 'missing-metadata'
type Kind = 'grouped' | SpecialKind

const SPECIAL_KINDS: { id: SpecialKind; label: string; title: string }[] = [
  { id: 'largest-expenses', label: 'Largest individual expenses', title: 'Largest expenses' },
  { id: 'added-over-time', label: 'Documents added over time', title: 'Documents added over time' },
  { id: 'missing-metadata', label: 'Missing metadata breakdown', title: 'Missing metadata' },
]

function defaultVisual(dimension: GroupByDimension): ChartVisual {
  return dimension === 'month' || dimension === 'year' ? 'line' : 'bar'
}

function suggestTitle(dimension: GroupByDimension, metric: ChartMetric): string {
  const label = DIMENSIONS.find((d) => d.id === dimension)?.label ?? dimension
  return metric === 'total' ? `Spending by ${label.toLowerCase()}` : `${label} — document count`
}

export function AddChartDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (config: ChartConfig) => void
}) {
  const [kind, setKind] = useState<Kind>('grouped')
  const [dimension, setDimension] = useState<GroupByDimension>('correspondent')
  const [metric, setMetric] = useState<ChartMetric>('total')
  const [visual, setVisual] = useState<ChartVisual>('bar')
  const [title, setTitle] = useState(suggestTitle('correspondent', 'total'))
  const [titleTouched, setTitleTouched] = useState(false)

  function updateDimension(next: GroupByDimension) {
    setDimension(next)
    setVisual(defaultVisual(next))
    if (!titleTouched) setTitle(suggestTitle(next, metric))
  }

  function updateMetric(next: ChartMetric) {
    setMetric(next)
    if (!titleTouched) setTitle(suggestTitle(dimension, next))
  }

  function handleAdd() {
    const id = crypto.randomUUID()
    if (kind === 'grouped') {
      onAdd({
        id,
        title: title.trim() || suggestTitle(dimension, metric),
        kind: 'grouped',
        dimension,
        metric,
        visual,
        limit: 10,
      })
    } else {
      const special = SPECIAL_KINDS.find((s) => s.id === kind)!
      onAdd({ id, title: title.trim() || special.title, kind: special.id })
    }
    onOpenChange(false)
    setTitleTouched(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add chart</DialogTitle>
          <DialogDescription>
            Pick what to chart. Grouped charts can combine any dimension with a metric and
            visual type.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Chart type</Label>
            <Select
              value={kind}
              onValueChange={(v) => {
                const next = v as Kind
                setKind(next)
                if (!titleTouched) {
                  setTitle(
                    next === 'grouped'
                      ? suggestTitle(dimension, metric)
                      : (SPECIAL_KINDS.find((s) => s.id === next)?.title ?? ''),
                  )
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grouped">Grouped chart (pick a dimension)</SelectItem>
                {SPECIAL_KINDS.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {kind === 'grouped' && (
            <>
              <div className="space-y-1.5">
                <Label>Dimension</Label>
                <Select value={dimension} onValueChange={(v) => updateDimension(v as GroupByDimension)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIMENSIONS.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Metric</Label>
                <Select value={metric} onValueChange={(v) => updateMetric(v as ChartMetric)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="total">Total amount</SelectItem>
                    <SelectItem value="count">Document count</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Visual</Label>
                <Select value={visual} onValueChange={(v) => setVisual(v as ChartVisual)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bar">Bar (ranking)</SelectItem>
                    <SelectItem value="line">Line (trend)</SelectItem>
                    <SelectItem value="pie">Pie (share of whole, top 3 + Other)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              value={title}
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
