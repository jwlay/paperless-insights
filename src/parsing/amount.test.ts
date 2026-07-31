import { describe, expect, it } from 'vitest'
import { findAmountFieldId, parseAmountValue } from './amount'

describe('parseAmountValue', () => {
  it('parses real Paperless custom field values', () => {
    expect(parseAmountValue('USD25.11')).toEqual({ currency: 'USD', amount: 25.11 })
    expect(parseAmountValue('EUR71.39')).toEqual({ currency: 'EUR', amount: 71.39 })
    expect(parseAmountValue('IDR549000.00')).toEqual({ currency: 'IDR', amount: 549000 })
  })

  it('returns null for missing or malformed values', () => {
    expect(parseAmountValue(null)).toBeNull()
    expect(parseAmountValue('')).toBeNull()
    expect(parseAmountValue('not a monetary value')).toBeNull()
    expect(parseAmountValue('25.11')).toBeNull()
  })
})

describe('findAmountFieldId', () => {
  it('detects the field by data_type, not by a hardcoded id', () => {
    const id = findAmountFieldId([
      { id: 1, name: 'Total Amount', data_type: 'monetary', extra_data: { select_options: [], default_currency: null }, document_count: 37 },
    ])
    expect(id).toBe(1)
  })

  it('returns null when no monetary field exists', () => {
    expect(findAmountFieldId([])).toBeNull()
  })
})
