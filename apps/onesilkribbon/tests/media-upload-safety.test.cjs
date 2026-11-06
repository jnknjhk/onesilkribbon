const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const source = fs.readFileSync(
  path.resolve(__dirname, '../admin/api/media.js'),
  'utf8'
).replace(/^import .*$/gm, '').replace(/^export /gm, '')

const jpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, ...Array(20).fill(0)])
const png = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, ...Array(16).fill(0)])
const text = Buffer.from('not an image at all')

function fakeFile({ bytes = jpeg, type = 'image/jpeg', name = 'photo.jpg', size = bytes.length } = {}) {
  return {
    name,
    type,
    size,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  }
}

function harness({ file = fakeFile(), namespace = 'product', insertError = null } = {}) {
  const calls = { upload: [], remove: [], inserted: null }
  const storage = {
    from() {
      return {
        upload: async (filePath, buffer, options) => {
          calls.upload.push({ filePath, buffer, options })
          return { error: null }
        },
        getPublicUrl: filePath => ({ data: { publicUrl: `https://cdn.example/${filePath}` } }),
        remove: async paths => { calls.remove.push(paths); return { error: null } },
      }
    },
  }
  const supabaseAdmin = {
    storage,
    from() {
      return {
        insert(row) {
          calls.inserted = row
          return {
            select() {
              return {
                single: async () => insertError
                  ? { data: null, error: insertError }
                  : { data: { id: 'media-1', ...row }, error: null },
              }
            },
          }
        },
      }
    },
  }
  const POST = new Function(
    'supabaseAdmin', 'verifyAdmin', 'errorResponse', 'fetchAll', 'randomUUID',
    source + ';return POST'
  )(
    supabaseAdmin,
    async () => ({ email: 'admin@example.com' }),
    () => Response.json({ error: 'Operation failed safely' }, { status: 500 }),
    async () => ({ data: [], error: null }),
    () => 'abcdef123456'
  )
  const req = {
    formData: async () => ({
      get: key => (key === 'file' ? file : key === 'namespace' ? namespace : null),
    }),
  }
  return { calls, post: () => POST(req) }
}

test('valid JPEG uploads are stored with a generated image extension', async () => {
  const h = harness()
  const response = await h.post()
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.media.id, 'media-1')
  assert.equal(h.calls.upload.length, 1)
  assert.match(h.calls.upload[0].filePath, /^product\/\d+-abcdef123456\.jpg$/)
  assert.equal(h.calls.upload[0].options.contentType, 'image/jpeg')
  assert.equal(h.calls.inserted.namespace, 'product')
  assert.equal(h.calls.inserted.size_bytes, jpeg.length)
})

test('valid PNG content is accepted even when the declared type is omitted', async () => {
  const h = harness({ file: fakeFile({ bytes: png, type: '', name: 'image.bin' }) })
  const response = await h.post()
  assert.equal(response.status, 200)
  assert.equal(h.calls.upload[0].options.contentType, 'image/png')
  assert.match(h.calls.upload[0].filePath, /\.png$/)
})

test('non-image types and mismatched signatures are rejected', async () => {
  for (const file of [
    fakeFile({ bytes: jpeg, type: 'text/plain' }),
    fakeFile({ bytes: jpeg, type: 'image/png' }),
    fakeFile({ bytes: text, type: 'image/jpeg' }),
  ]) {
    const h = harness({ file })
    const response = await h.post()
    assert.equal(response.status, 400)
    assert.equal(h.calls.upload.length, 0)
  }
})

test('invalid namespaces and oversized files are rejected before storage', async () => {
  const badNamespace = harness({ namespace: '../outside' })
  assert.equal((await badNamespace.post()).status, 400)
  assert.equal(badNamespace.calls.upload.length, 0)

  const oversized = harness({ file: fakeFile({ size: 4 * 1024 * 1024 + 1 }) })
  assert.equal((await oversized.post()).status, 413)
  assert.equal(oversized.calls.upload.length, 0)
})

test('a failed database insert removes the just-uploaded storage file', async () => {
  const h = harness({ insertError: { message: 'db down' } })
  const response = await h.post()
  assert.equal(response.status, 500)
  assert.equal(h.calls.upload.length, 1)
  assert.equal(h.calls.remove.length, 1)
  assert.deepEqual(h.calls.remove[0], [h.calls.upload[0].filePath])
})
