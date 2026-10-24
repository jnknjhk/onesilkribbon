// Shared by browser, Node and edge: no runtime-specific imports or network calls.
const OMIT = Symbol('omit')
const MAX_DEPTH = 16
const MAX_NODES = 10000
const MAX_STRING = 32768
const MAX_TEXT = 262144
const MAX_KEY = 256

const normalizeKey = key => key.toLowerCase().replace(/[^a-z0-9]/g, '')
const PRIVATE_KEYS = /email|password|passwd|proof|token|session|authorization|authentication|cookie|secret|apikey|firstname|lastname|shippingname|billingname|customername|recipientname|contactname|fullname|address|phone|telephone|querystring|(?:request|response)(?:body|data)|(?:client|user|remote)ip/
const PRIVATE_FIELDS = new Set([
  'user', 'username', 'namefirst', 'namelast', 'first', 'last', 'auth', 'credentials',
  'shipping', 'billing', 'customer', 'contact', 'recipient',
  'ip', 'ipaddr', 'clientip', 'remoteip', 'remoteaddr', 'remoteaddress',
  'line1', 'line2', 'city', 'state', 'province', 'postcode', 'postalcode', 'zipcode', 'dialcode',
  'body', 'requestbody', 'query', 'querystring', 'search', 'hash', 'fragment',
  'sdkprocessingmetadata', 'attachments', 'proto', 'constructor', 'prototype', 'tojson',
])
// Unknown/custom headers can carry credentials too; retain only useful diagnostics.
const SAFE_HEADERS = new Set(['accept', 'contenttype', 'contentlength', 'host', 'referer', 'referrer'])

function scrubText(text) {
  // Strip userinfo from every authority, including URLs embedded in prose.
  return text
    .replace(/([/\\]{2})([^\s<>"`/?#\\]*)/g, (_, prefix, authority) =>
      prefix + authority.slice(authority.lastIndexOf('@') + 1))
    .replace(/\b((?:https?|ftp):[/\\]*)([^\s<>"`/?#\\]*@)/gi, '$1')
    // Deliberately also covers bare paths, query-only and fragment-only references.
    .replace(/[?#]\S*/g, '')
    // Tokenize first so long non-email strings cannot cause quadratic matching.
    .replace(/[^\s<>"'`]+/g, word => /@[^/@]+\.[a-z\d]/i.test(word) ? '[Filtered]' : word)
    // Console/exception strings can carry labeled secrets without an object key.
    .replace(/\b(?:email|password|passwd|proof|(?:access[_-]?)?token|session[_-]?id|authorization|cookie|first[\s_-]?name|last[\s_-]?name|shipping[\s_-]?name|address|phone)["']?\s*[=:]\s*[\s\S]*/gi, '[Filtered]')
}

function isRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  // Accept plain records from other realms too, without calling their methods.
  return prototype === null || Object.getPrototypeOf(prototype) === null
}

function scrub(input) {
  try {
    if (!isRecord(input)) return null
    const active = new WeakSet()
    let nodes = 0
    let textSize = 0

    function visit(value, depth, field = '') {
      if (++nodes > MAX_NODES) throw new Error('Telemetry size limit')
      if (depth > MAX_DEPTH) return OMIT
      if ((field === 'request' || field === 'normalizedrequest' || field === 'headers') && !isRecord(value)) return OMIT
      if (value === null || typeof value === 'boolean') return value
      if (typeof value === 'number') return Number.isFinite(value) ? value : OMIT
      if (typeof value === 'string') {
        if (value === '[Filtered]') return value
        textSize += value.length
        if (textSize > MAX_TEXT) throw new Error('Telemetry text limit')
        if (value.length > MAX_STRING) return OMIT
        const trimmed = value.trim()
        // Serialized payloads in extra/contexts must not bypass key filtering.
        if (/^(?:\{|\[)/.test(trimmed)) {
          try {
            const parsed = JSON.parse(trimmed)
            const clean = visit(parsed, depth + 1, field)
            return clean === OMIT ? OMIT : JSON.stringify(clean)
          } catch {
            return OMIT
          }
        }
        // URL-valued fields may contain malformed URLs with literal whitespace.
        if (/url|uri|filename|abspath|referer|referrer/.test(field) || field === 'from' || field === 'to') {
          value = value.split(/[?#]/, 1)[0]
        }
        return scrubText(value)
      }
      if (typeof value !== 'object' || active.has(value)) return OMIT
      const array = Array.isArray(value)
      if ((!array && !isRecord(value)) || (array && field === 'headers')) return OMIT
      active.add(value)
      try {
        const descriptors = Object.getOwnPropertyDescriptors(value)
        const keys = Object.keys(descriptors)
        if (keys.length > MAX_NODES - nodes) throw new Error('Telemetry size limit')
        const output = array ? [] : {}
        for (const key of keys) {
          const descriptor = descriptors[key]
          // Do not execute accessors/toJSON while preparing telemetry.
          if (!descriptor.enumerable || !('value' in descriptor)) continue
          if (key.length > MAX_KEY) continue
          textSize += key.length
          if (textSize > MAX_TEXT) throw new Error('Telemetry text limit')
          const normalized = normalizeKey(key)
          if (PRIVATE_KEYS.test(normalized) || PRIVATE_FIELDS.has(normalized)) continue
          if (field === 'headers' && !SAFE_HEADERS.has(normalized)) continue
          if ((field === 'request' || field === 'normalizedrequest') && normalized === 'data') continue
          const clean = visit(descriptor.value, depth + 1, normalized)
          if (clean === OMIT) continue
          const cleanKey = scrubText(key)
          if (!cleanKey || Object.prototype.hasOwnProperty.call(output, cleanKey)) continue
          Object.defineProperty(output, cleanKey, { value: clean, enumerable: true, configurable: true, writable: true })
        }
        return output
      } finally {
        active.delete(value)
      }
    }

    const result = visit(input, 0)
    return result === OMIT ? null : result
  } catch {
    // Never return the original on reflection/proxy failures or exhausted limits.
    return null
  }
}

// Sentry 10 restores the ORIGINAL span when beforeSendSpan returns null.
// Return an empty redacted object on failure instead; other hooks may drop it.
export const telemetryPrivacyHooks = {
  beforeSend: scrub,
  beforeSendTransaction: scrub,
  beforeSendSpan: span => scrub(span) || {},
  beforeBreadcrumb: scrub,
}
