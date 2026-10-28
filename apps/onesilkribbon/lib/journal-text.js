export function safeJournalHref(value) {
  if (typeof value !== 'string' || /[\u0000-\u0020\u007f\\]/.test(value)) return null
  if (/^\/(?!\/)/.test(value) || /^#[\w-]+$/.test(value)) return value
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null
  } catch { return null }
}

// Only labelled links are interpreted. HTML and executable Markdown remain text.
export function journalInlineParts(value = '') {
  const text = String(value)
  const parts = []
  const pattern = /\[([^\]\n]+)\]\(([^\s)]+)\)/g
  let cursor = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index > cursor) parts.push({ text: text.slice(cursor, match.index) })
    parts.push({ text: match[1], href: safeJournalHref(match[2]) })
    cursor = match.index + match[0].length
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) })
  return parts
}

export function journalTextBlocks(value = '') {
  return String(value).replace(/\r\n/g, '\n').split(/\n\s*\n/).map(text => text.trim()).filter(Boolean).map(text => {
    const lines = text.split('\n')
    return lines.every(line => /^> ?/.test(line))
      ? { type: 'quote', lines: lines.map(line => line.replace(/^> ?/, '')) }
      : { type: 'paragraph', text }
  })
}

export function usesAutumnLayout(post) {
  return Array.isArray(post?.sections) && post.sections.some(section => section?.template === 'autumn')
}

export function journalSections(post) {
  const used = new Set()
  return (Array.isArray(post?.sections) ? post.sections : []).filter(section => section && (
    section.type === 'image' ? !!section.url : !!(section.heading || section.body)
  )).map((section, i) => {
    const candidate = typeof section.id === 'string' && /^[a-z][a-z0-9-]*$/.test(section.id) ? section.id : `section-${i + 1}`
    let id = candidate
    let suffix = 1
    while (used.has(id)) id = `${candidate}-${++suffix}`
    used.add(id)
    return { ...section, id }
  })
}
