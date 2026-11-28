// Storefront navigation for the live catalogue.
// Only collections with purchasable products belong here; preview-only rooms
// (fabric by the metre, pillowcases, masks, scrunchies) stay out of production.
export const RIBBON_HOUSES = [
  {
    slug: 'fine-silk-ribbons',
    label: 'Fine Silk Ribbons',
    href: '/collections/fine-silk-ribbons',
    note: '2–13 mm · 10 m spool',
    blurb: 'Ultra-fine mulberry silk ribbon for embroidery, miniatures and fine stationery.',
  },
  {
    slug: 'hand-frayed-silk-ribbons',
    label: 'Hand-Frayed Silk Ribbons',
    href: '/collections/hand-frayed-silk-ribbons',
    note: '5 widths · 3 lengths',
    blurb: 'Hand-torn crêpe satin on reusable wooden spools, with a soft, organic edge.',
  },
  {
    slug: 'vintage-inspired-ribbons',
    label: 'Vintage-Inspired Ribbons',
    href: '/collections/vintage-inspired-ribbons',
    note: '10 mm crinkle · wooden spool',
    blurb: 'Hand-distressed mulberry silk with an heirloom texture and a quiet lustre.',
  },
]

export const RIBBON_HOUSE_SLUGS = RIBBON_HOUSES.map(house => house.slug)

export const SHOP_GROUPS = [
  {
    id: 'ribbons',
    label: 'Silk Ribbons',
    href: '/collections#ribbons',
    note: 'Three ribbon houses',
    links: RIBBON_HOUSES.map(({ label, href, note }) => ({ label, href, note })),
  },
  {
    id: 'adornments',
    label: 'Handcrafted Adornments',
    href: '/collections/handcrafted-adornments',
    note: 'Mini bows & brooches',
    links: [
      {
        label: 'Silk Mini Bows',
        href: '/collections/handcrafted-adornments/handcrafted-1-5cm-mulberry-silk-mini-bows',
        note: 'Hand-tied · 1.5 cm',
      },
      {
        label: 'Gold Pumpkin Brooch',
        href: '/collections/handcrafted-adornments/handcrafted-gold-silk-pumpkin-brooch-with-ribbon-embroidery-coquette-cottagecore-floral-pin',
        note: 'Ribbon embroidery',
      },
      {
        label: 'Blue Morning Glory Brooch',
        href: '/collections/handcrafted-adornments/blue-morning-glory-brooch',
        note: 'Ribbon embroidery',
      },
    ],
  },
  {
    id: 'studio-tools',
    label: 'Studio Tools',
    href: '/collections/studio-tools',
    note: 'For the workbench',
    links: [
      {
        label: 'Wooden Spool · 2.3 × 3 cm',
        href: '/collections/studio-tools/artisan-wooden-spool-2-3-x-3cm',
        note: 'Beechwood · from £0.40',
      },
      {
        label: 'Embroidery Hoops',
        href: '/collections/studio-tools/adjustable-beechwood-embroidery-hoop',
        note: 'Adjustable beechwood',
      },
      {
        label: 'Embroidery Stands',
        href: '/collections/studio-tools/adjustable-beechwood-embroidery-stand',
        note: 'Tabletop butterfly clamp',
      },
    ],
  },
]

export const FOOTER_SHOP_LINKS = [
  { label: 'Silk Ribbons', href: '/collections#ribbons' },
  ...RIBBON_HOUSES.map(({ label, href }) => ({ label, href })),
  { label: 'Handcrafted Adornments', href: '/collections/handcrafted-adornments' },
  { label: 'Studio Tools', href: '/collections/studio-tools' },
]
