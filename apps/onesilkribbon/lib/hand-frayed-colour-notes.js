export const HAND_FRAYED_CONTENT_UPDATED_AT = '2026-11-21'

const colourNotes = {
  'pearl-white-hand-frayed-silk-ribbon': 'Pair Pearl White hand-frayed silk ribbon with white flowers and greenery. For ivory stationery, compare a sample against the paper in daylight before tying the full set.',
  'lotus-pink-hand-frayed-silk-ribbon': 'Pair Lotus Pink hand-frayed silk ribbon with blush flowers and grey-green foliage. Tie a test bow on your invitation to see how the pink reads against the paper.',
}

export function handFrayedColourNote(collection, slug) {
  if (collection !== 'hand-frayed-silk-ribbons') return undefined
  return Object.hasOwn(colourNotes, slug) ? colourNotes[slug] : undefined
}
