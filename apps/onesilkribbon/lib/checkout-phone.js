const TRUNK_ZERO_CODES = new Set(['+44', '+61', '+49', '+33', '+31', '+46', '+32', '+43', '+353', '+41', '+81', '+971'])

export const hasCheckoutTrunkZero = dialCode => TRUNK_ZERO_CODES.has(dialCode)

export function splitCheckoutPhone(value, defaultDialCode, dialCodes) {
  const clean = (value || '').trim().replace(/[\s().-]/g, '').replace(/^00/, '+')
  const dialCode = dialCodes.find(code => clean.startsWith(code))
  return dialCode ? { dialCode, phone: clean.slice(dialCode.length) }
    : { dialCode: defaultDialCode, phone: clean }
}

export function formatCheckoutPhone({ phone, dialCode }) {
  if (!phone) return null
  const clean = phone.replace(/[\s().-]/g, '').replace(/^00/, '+')
  if (clean.startsWith('+') || !dialCode) return clean
  return `${dialCode} ${TRUNK_ZERO_CODES.has(dialCode) ? clean.replace(/^0/, '') : clean}`
}
