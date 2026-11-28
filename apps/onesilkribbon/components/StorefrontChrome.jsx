import { getStorefrontAvailability } from '@/lib/storefront-availability'
import { Navbar } from './Navbar'
import { Footer } from './Footer'

export async function StorefrontNavbar() {
  const { fabricAvailable } = await getStorefrontAvailability()
  return <Navbar fabricAvailable={fabricAvailable} />
}

export async function StorefrontFooter() {
  const { fabricAvailable } = await getStorefrontAvailability()
  return <Footer fabricAvailable={fabricAvailable} />
}
