const INITIAL_CONTENT_DATE = '2026-11-21'

const colourNotes = {
  burgundy: 'Pair Burgundy hand-frayed silk ribbon with cream roses and muted greenery. For a bouquet, tie a loose knot and leave the tails long enough for the frayed edges to show.',
  'pearl-white-hand-frayed-silk-ribbon': 'Pair Pearl White hand-frayed silk ribbon with white flowers and greenery. For ivory stationery, compare a sample against the paper in daylight before tying the full set.',
  'lotus-pink-hand-frayed-silk-ribbon': 'Pair Lotus Pink hand-frayed silk ribbon with blush flowers and grey-green foliage. Tie a test bow on your invitation to see how the pink reads against the paper.',
}

export function handFrayedColourNoteUpdatedAt(collection, slug) {
  if (!handFrayedColourNote(collection, slug)) return undefined
  return slug === 'burgundy' ? '2026-11-26' : INITIAL_CONTENT_DATE
}

export function handFrayedColourNote(collection, slug) {
  if (collection !== 'hand-frayed-silk-ribbons') return undefined
  return Object.hasOwn(colourNotes, slug) ? colourNotes[slug] : undefined
}
