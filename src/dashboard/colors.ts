// Validated palette (light + dark) — see the dataviz skill's palette.md.
// ECharts renders to canvas, which can't inherit CSS variables the way the
// rest of the app (shadcn/Tailwind, AG Grid) does, so light/dark values are
// picked explicitly in JS based on the OS color scheme (see lib/theme.ts).
//
// Only the first 3 categorical slots are used for any all-pairs-visible
// context (e.g. a pie chart), per the "past three, fold to Other" rule.
export interface ChartPalette {
  categorical: readonly [string, string, string]
  categoricalOther: string
  accent: string
  warning: string
  surface: string
  ink: {
    primary: string
    secondary: string
    muted: string
    gridline: string
    axis: string
  }
}

const LIGHT: ChartPalette = {
  categorical: ['#2a78d6', '#eb6834', '#1baf7a'],
  categoricalOther: '#898781',
  accent: '#2a78d6',
  warning: '#fab219',
  surface: '#fcfcfb',
  ink: {
    primary: '#0b0b0b',
    secondary: '#52514e',
    muted: '#898781',
    gridline: '#e1e0d9',
    axis: '#c3c2b7',
  },
}

const DARK: ChartPalette = {
  categorical: ['#3987e5', '#d95926', '#199e70'],
  categoricalOther: '#898781',
  accent: '#3987e5',
  warning: '#fab219',
  surface: '#1a1a19',
  ink: {
    primary: '#ffffff',
    secondary: '#c3c2b7',
    muted: '#898781',
    gridline: '#2c2c2a',
    axis: '#383835',
  },
}

export function getPalette(isDark: boolean): ChartPalette {
  return isDark ? DARK : LIGHT
}
