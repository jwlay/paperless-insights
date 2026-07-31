import { describe, expect, it } from 'vitest'
import { parseCustomFieldValue, type CustomFieldDef } from './customFields'

function def(overrides: Partial<CustomFieldDef>): CustomFieldDef {
  return { id: 1, name: 'Field', dataType: 'string', selectOptions: [], ...overrides }
}

describe('parseCustomFieldValue', () => {
  it('parses real Paperless monetary values', () => {
    expect(parseCustomFieldValue(def({ dataType: 'monetary' }), 'USD25.11')).toMatchObject({
      display: 'USD 25.11',
      numericValue: 25.11,
      currency: 'USD',
    })
    expect(parseCustomFieldValue(def({ dataType: 'monetary' }), 'IDR549000.00')).toMatchObject({
      numericValue: 549000,
      currency: 'IDR',
    })
  })

  it('falls back gracefully for malformed monetary values', () => {
    const result = parseCustomFieldValue(def({ dataType: 'monetary' }), 'not-money')
    expect(result.numericValue).toBeNull()
    expect(result.currency).toBeNull()
    expect(result.display).toBe('not-money')
  })

  it('treats missing values as null across all types', () => {
    expect(parseCustomFieldValue(def({ dataType: 'monetary' }), null).display).toBeNull()
    expect(parseCustomFieldValue(def({ dataType: 'integer' }), '').display).toBeNull()
  })

  it('parses numeric types', () => {
    expect(parseCustomFieldValue(def({ dataType: 'integer' }), '42').numericValue).toBe(42)
    expect(parseCustomFieldValue(def({ dataType: 'float' }), '3.5').numericValue).toBe(3.5)
  })

  it('parses booleans', () => {
    expect(parseCustomFieldValue(def({ dataType: 'boolean' }), 'true').display).toBe('Yes')
    expect(parseCustomFieldValue(def({ dataType: 'boolean' }), 'false').display).toBe('No')
  })

  it('resolves select values by index into selectOptions, falling back to raw', () => {
    const selectDef = def({ dataType: 'select', selectOptions: ['Low', 'Medium', 'High'] })
    expect(parseCustomFieldValue(selectDef, '1').display).toBe('Medium')
    expect(parseCustomFieldValue(selectDef, 'Custom').display).toBe('Custom')
  })
})
