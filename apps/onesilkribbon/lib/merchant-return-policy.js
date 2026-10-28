export const STANDARD_RETURN_DAYS = 14
export const RETURNS_POLICY_URL = 'https://onesilkribbon.com/shipping-returns'

export function productReturnPolicy() {
  // The owner confirmed all current fixed catalogue options, including ribbons,
  // use the standard window. Bespoke requests are handled separately and are
  // not represented by these fixed catalogue offers.
  return {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: 'GB',
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: STANDARD_RETURN_DAYS,
    returnMethod: 'https://schema.org/ReturnByMail',
    returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
    merchantReturnLink: RETURNS_POLICY_URL,
  }
}
