import { auth } from '../lib/firebase'

const base = '/.netlify/functions'

async function authedFetch(path: string, data?: any, options?: RequestInit) {
  const user = auth.currentUser
  if (!user) throw new Error('not_authenticated')
  const idToken = await user.getIdToken()
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: data ? JSON.stringify(data) : undefined,
    ...options,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error?.message || 'request_failed')
  return json
}

export const api = {
  setAdmin: (email: string, make: boolean) => authedFetch('/auth/setAdmin', { email, make }),
  createSubmission: (payload: any) => authedFetch('/submission/create', payload),
  updateStatus: (submissionId: string, status: 'uploaded'|'processing'|'completed'|'rejected') => authedFetch('/submission/updateStatus', { submissionId, status }),
  appendResult: (submissionId: string, filename: string, contentType: string, size?: number) => authedFetch('/submission/appendResult', { submissionId, filename, contentType, size }),
  createUploadUrl: (submissionId: string, filename: string, contentType: string, size?: number) => authedFetch('/storage/createUploadUrl', { submissionId, filename, contentType, size }),
  createDownloadUrl: (storagePath: string) => authedFetch('/storage/createDownloadUrl', { storagePath }),
  addMessage: (submissionId: string, text: string) => authedFetch('/submission/message', { submissionId, text }),
}
