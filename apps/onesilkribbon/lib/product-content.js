import sanitizeHtml from 'sanitize-html'

export function safeProductHtml(description) {
  return sanitizeHtml(typeof description === 'string' ? description.replace(/\n/g, '<br>') : '', {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'blockquote', 'a', 'span'],
    allowedAttributes: { a: ['href', 'title'] },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowProtocolRelative: false,
  })
}
