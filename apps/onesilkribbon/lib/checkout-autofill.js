const ADDRESS_FIELDS = ['line1', 'line2', 'city', 'postcode', 'country']

// A delayed saved-address response must not overwrite anything the customer
// has typed or cleared, nor mix a saved address with a partly typed one.
export function mergeCheckoutAutofill(previous, defaults, edited) {
  const addressEdited = ADDRESS_FIELDS.some(key => edited.has(key))
  const next = { ...previous }
  for (const key of Object.keys(previous)) {
    if (edited.has(key) || (addressEdited && (ADDRESS_FIELDS.includes(key) || key === 'dialCode'))) continue
    if (defaults[key] !== undefined && defaults[key] !== null && defaults[key] !== '') next[key] = defaults[key]
  }
  return next
}
