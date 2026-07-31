import { useEffect, useState } from 'react'

function prefersDarkQuery() {
  return window.matchMedia('(prefers-color-scheme: dark)')
}

/** Tracks the OS/browser color scheme preference — no in-app toggle, per design. */
export function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState(() => prefersDarkQuery().matches)

  useEffect(() => {
    const query = prefersDarkQuery()
    const listener = (e: MediaQueryListEvent) => setIsDark(e.matches)
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }, [])

  return isDark
}
