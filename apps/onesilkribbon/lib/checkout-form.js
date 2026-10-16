// Validate before reserving stock or contacting a payment provider.
export function checkoutForm(input) {
  const bad = () => { const error = new Error('Please check your contact and delivery details.'); error.code = 'INVALID_CHECKOUT_FORM'; throw error }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return bad()
  const form = {}
  for (const [field, max, required] of [
    ['email',254,true], ['firstName',100,true], ['lastName',100,true], ['line1',200,true],
    ['line2',200,false], ['city',100,true], ['postcode',32,false], ['country',2,true], ['phone',40,false], ['dialCode',10,false],
  ]) {
    if (input[field] != null && typeof input[field] !== 'string') return bad()
    const value = (input[field] || '').trim()
    if ((required && !value) || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) return bad()
    form[field] = value
  }
  form.email = form.email.toLowerCase()
  form.country = form.country.toUpperCase()
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(form.email) || !/^[A-Z]{2}$/.test(form.country)) return bad()
  return form
}
