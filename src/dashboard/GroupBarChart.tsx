import type { GroupSummary } from './aggregate'

export function GroupBarChart({
  groups,
  valueOf,
  valueLabel,
  limit = 12,
}: {
  groups: GroupSummary[]
  valueOf: (group: GroupSummary) => number
  valueLabel: (value: number) => string
  limit?: number
}) {
  const ranked = groups
    .map((group) => ({ group, value: valueOf(group) }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)

  if (ranked.length === 0) {
    return <p className="text-sm text-muted-foreground">No amounts to chart for this view.</p>
  }

  const max = ranked[0].value

  return (
    <div className="flex flex-col gap-2">
      {ranked.map(({ group, value }) => (
        <div
          key={group.key}
          className="group flex items-center gap-3"
          title={`${group.label}: ${valueLabel(value)}`}
        >
          <span className="w-36 shrink-0 truncate text-sm text-muted-foreground" title={group.label}>
            {group.label}
          </span>
          <div className="h-5 flex-1 rounded bg-muted">
            <div
              className="h-5 rounded bg-primary transition-[width] group-hover:opacity-80"
              style={{ width: `${(value / max) * 100}%` }}
            />
          </div>
          <span className="w-28 shrink-0 text-right text-sm font-medium tabular-nums">
            {valueLabel(value)}
          </span>
        </div>
      ))}
    </div>
  )
}
