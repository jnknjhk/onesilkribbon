import 'server-only'
import { createHmac, randomUUID } from 'node:crypto'
import { supabaseAdmin } from '@osr/core/lib/supabase'
import { EMAIL_ATTACHMENT_BUCKET, MAX_EMAIL_ATTACHMENTS, MAX_EMAIL_ATTACHMENT_BYTES } from './email-attachments'

const fileId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const storage = () => supabaseAdmin.storage.from(EMAIL_ATTACHMENT_BUCKET)
const folderFor = email => createHmac('sha256', process.env.SUPABASE_SERVICE_KEY)
  .update('admin-email-attachments:' + email.toLowerCase()).digest('hex')

export function validEmailAttachmentIds(ids) {
  return Array.isArray(ids) && ids.length <= MAX_EMAIL_ATTACHMENTS && new Set(ids).size === ids.length &&
    ids.every(id => typeof id === 'string' && fileId.test(id))
}

async function ensurePrivateBucket() {
  const storageAdmin = supabaseAdmin.storage
  let { data, error } = await storageAdmin.getBucket(EMAIL_ATTACHMENT_BUCKET)
  if (error && (error.status === 404 || error.statusCode === '404' || /bucket not found/i.test(error.message))) {
    const created = await storageAdmin.createBucket(EMAIL_ATTACHMENT_BUCKET, { public: false, fileSizeLimit: MAX_EMAIL_ATTACHMENT_BYTES })
    // Read again so concurrent first uploads can share the newly created bucket.
    const existing = await storageAdmin.getBucket(EMAIL_ATTACHMENT_BUCKET)
    data = existing.data
    error = existing.error && (created.error || existing.error)
  }
  if (error) throw error
  if (data?.public !== false) throw new Error('Email attachments require a private storage bucket')
}

export async function prepareEmailAttachmentUploads(email, count) {
  await ensurePrivateBucket()
  const folder = folderFor(email)
  const bucket = storage()
  const expiredBefore = Date.now() - 3 * 60 * 60 * 1000
  const { data: recent } = await bucket.list(folder, { limit: 100, sortBy: { column: 'created_at', order: 'asc' } })
  const expired = (recent || []).filter(item => fileId.test(item.name) && Date.parse(item.created_at) < expiredBefore)
  if (expired.length) await bucket.remove(expired.map(item => `${folder}/${item.name}`))

  return Promise.all(Array.from({ length: count }, async () => {
    const id = randomUUID()
    const path = `${folder}/${id}`
    const { data, error } = await bucket.createSignedUploadUrl(path, { upsert: false })
    if (error) throw error
    return { id, path, token: data.token }
  }))
}

export async function readEmailAttachments(email, files) {
  const folder = folderFor(email)
  const attachments = []
  for (const { id, name, size } of files) {
    const { data, error } = await storage().download(`${folder}/${id}`)
    if (error || data?.size !== size) return null
    attachments.push({ filename: name, content: Buffer.from(await data.arrayBuffer()).toString('base64') })
  }
  return attachments
}

export async function removeEmailAttachmentUploads(email, ids) {
  if (!ids.length) return
  const folder = folderFor(email)
  const { error } = await storage().remove(ids.map(id => `${folder}/${id}`))
  if (error) throw error
}
