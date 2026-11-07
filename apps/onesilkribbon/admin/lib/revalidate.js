import { revalidatePath } from 'next/cache'

// 后台写入后主动让前台 ISR 失效；否则首页/系列/商品页最多要等 60 秒才更新。
export function revalidateCatalog() {
  revalidatePath('/')
  revalidatePath('/collections')
  revalidatePath('/collections/[slug]', 'page')
  revalidatePath('/collections/[slug]/[productSlug]', 'page')
  revalidatePath('/sitemap.xml')
  revalidatePath('/api/google-feed')
}

export function revalidateSiteImages() {
  revalidatePath('/')
  revalidatePath('/about')
  revalidatePath('/collections')
  revalidatePath('/collections/[slug]', 'page')
  revalidatePath('/collections/[slug]/[productSlug]', 'page')
}

export function revalidateSettings() {
  revalidatePath('/')
  revalidatePath('/collections/[slug]/[productSlug]', 'page')
}
