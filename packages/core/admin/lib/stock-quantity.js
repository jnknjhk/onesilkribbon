// Stock uses PostgreSQL integer values. Empty fields, booleans and fractions
// must never be coerced to zero or silently truncated.
export function parseStockQuantity(value, { allowNegative = false } = {}) {
  const pattern = allowNegative ? /^-?\d+$/ : /^\d+$/
  if (typeof value !== 'number' && (typeof value !== 'string' || !pattern.test(value.trim()))) return null
  const quantity = Number(value)
  return Number.isInteger(quantity) && quantity >= (allowNegative ? -2147483648 : 0) && quantity <= 2147483647 ? quantity : null
}
