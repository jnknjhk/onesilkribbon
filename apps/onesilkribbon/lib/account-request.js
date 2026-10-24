// Only same-site account endpoints may receive an authentication token.
export async function accountRequest(path, user, { method = 'GET', body, signal } = {}) {
  if (!/^\/api\/user\/[a-z-]+$/.test(path)) throw new Error('Invalid account endpoint')
  const headers = {}
  if (user?.accessToken) headers.Authorization = `Bearer ${user.accessToken}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const response = await fetch(path, {
    method, headers, signal, credentials: 'same-origin', cache: 'no-store',
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  if (!response.ok) throw new Error(response.status === 401
    ? 'Your session has expired. Please sign in again.'
    : 'We could not complete this request. Please try again.')
  const data = await response.json()
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid account response')
  return data
}
