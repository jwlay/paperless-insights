import type { CustomField, DocumentCustomFieldValue } from '@/api/types'

export interface ParsedAmount {
  currency: string
  amount: number
}

// Values look like "USD25.11", "EUR71.39", "IDR549000.00": ISO currency code
// immediately followed by a decimal number, no separator.
const AMOUNT_PATTERN = /^([A-Z]{3})(-?\d+(?:\.\d+)?)$/

export function findAmountFieldId(customFields: CustomField[]): number | null {
  return customFields.find((f) => f.data_type === 'monetary')?.id ?? null
}

export function parseAmountValue(raw: string | null | undefined): ParsedAmount | null {
  if (!raw) return null
  const match = AMOUNT_PATTERN.exec(raw.trim())
  if (!match) return null
  return { currency: match[1], amount: Number(match[2]) }
}

export function getAmountField(
  customFields: DocumentCustomFieldValue[],
  amountFieldId: number | null,
): DocumentCustomFieldValue | undefined {
  if (amountFieldId === null) return undefined
  return customFields.find((f) => f.field === amountFieldId)
}
