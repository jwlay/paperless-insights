import { describe, expect, it } from 'vitest'
import { tagsAsText } from './columns'

describe('tagsAsText', () => {
  it('joins tag names from an array', () => {
    expect(
      tagsAsText([
        { id: 1, name: 'Invoice', color: '#fff', textColor: '#000' },
        { id: 2, name: 'Paid', color: '#fff', textColor: '#000' },
      ]),
    ).toBe('Invoice, Paid')
  })

  it('passes through a string unchanged — AG Grid sometimes calls this with already-formatted text', () => {
    expect(tagsAsText('Invoice, Paid')).toBe('Invoice, Paid')
  })

  it('treats null/undefined as empty', () => {
    expect(tagsAsText(null)).toBe('')
    expect(tagsAsText(undefined)).toBe('')
  })

  it('handles an empty array', () => {
    expect(tagsAsText([])).toBe('')
  })
})
