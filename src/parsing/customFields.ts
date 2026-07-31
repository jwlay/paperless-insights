import type { CustomField } from '@/api/types'

export interface CustomFieldDef {
  id: number
  name: string
  dataType: string
  selectOptions: string[]
}

export function toCustomFieldDefs(fields: CustomField[]): CustomFieldDef[] {
  return fields.map((f) => ({
    id: f.id,
    name: f.name,
    dataType: f.data_type,
    selectOptions: f.extra_data?.select_options ?? [],
  }))
}

export function isNumericDataType(dataType: string): boolean {
  return dataType === 'monetary' || dataType === 'integer' || dataType === 'float'
}

export interface ParsedCustomFieldValue {
  fieldId: number
  fieldName: string
  dataType: string
  raw: string | null
  /** Human-readable rendering, e.g. "USD 25.11" for monetary, "Yes" for boolean. */
  display: string | null
  /** Usable for sum/average aggregation — set for monetary/integer/float, null otherwise. */
  numericValue: number | null
  /** Only set for monetary values. */
  currency: string | null
}

// Paperless monetary custom field values look like "USD25.11": an ISO
// currency code immediately followed by a decimal number, no separator.
const MONETARY_PATTERN = /^([A-Z]{3})(-?\d+(?:\.\d+)?)$/

export function parseCustomFieldValue(
  def: CustomFieldDef,
  raw: string | null | undefined,
): ParsedCustomFieldValue {
  const base = { fieldId: def.id, fieldName: def.name, dataType: def.dataType, raw: raw ?? null }

  if (raw == null || raw === '') {
    return { ...base, display: null, numericValue: null, currency: null }
  }

  switch (def.dataType) {
    case 'monetary': {
      const match = MONETARY_PATTERN.exec(raw.trim())
      if (!match) return { ...base, display: raw, numericValue: null, currency: null }
      return {
        ...base,
        display: `${match[1]} ${match[2]}`,
        numericValue: Number(match[2]),
        currency: match[1],
      }
    }
    case 'integer':
    case 'float': {
      const num = Number(raw)
      return { ...base, display: raw, numericValue: Number.isFinite(num) ? num : null, currency: null }
    }
    case 'boolean':
      return { ...base, display: raw === 'true' ? 'Yes' : 'No', numericValue: null, currency: null }
    case 'select': {
      // Best effort: Paperless has stored select values as an index into
      // extra_data.select_options in some versions, and as the literal
      // option string in others — try the index, fall back to the raw value.
      const index = Number(raw)
      const label = Number.isInteger(index) ? (def.selectOptions[index] ?? raw) : raw
      return { ...base, display: label, numericValue: null, currency: null }
    }
    default:
      // string, url, date, documentlink, long_text, etc. — shown as-is.
      return { ...base, display: raw, numericValue: null, currency: null }
  }
}
