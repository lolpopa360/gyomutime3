// Lightweight n8n client used by grouping/timetable pages
// Sends multipart/form-data to n8n Webhook nodes and expects JSON

function cfg() {
  return {
    sectioning: (typeof window !== 'undefined' && window.N8N_SECTIONING_WEBHOOK) || '',
    timetable: (typeof window !== 'undefined' && window.N8N_TIMETABLE_WEBHOOK) || '',
    auth: (typeof window !== 'undefined' && window.N8N_AUTH_TOKEN) || '',
  }
}

async function postMultipart(url, form) {
  const headers = {}
  const { auth } = cfg()
  if (auth) headers['authorization'] = `Bearer ${auth}`
  const resp = await fetch(url, { method: 'POST', body: form, headers })
  const ct = resp.headers.get('content-type') || ''
  const data = ct.includes('application/json') ? await resp.json() : await resp.text()
  if (!resp.ok) throw new Error((data && (data.error?.message || data.message)) || `HTTP ${resp.status}`)
  return data
}

async function submitSectioning({ name, email, notes, maxPerClass, minSlots, maxSlots, file }) {
  const { sectioning } = cfg()
  if (!sectioning) throw new Error('n8n SECTIONING_WEBHOOK이 설정되지 않았습니다.')
  const fd = new FormData()
  fd.set('kind', 'sectioning')
  if (name) fd.set('name', name)
  if (email) fd.set('email', email)
  if (notes) fd.set('notes', notes)
  fd.set('maxPerClass', String(maxPerClass ?? ''))
  fd.set('minSlots', String(minSlots ?? ''))
  fd.set('maxSlots', String(maxSlots ?? ''))
  if (file) fd.set('file', file, file.name || 'data')
  return postMultipart(sectioning, fd)
}

async function submitTimetable({ name, excludeRule, weekdayPeriods, moveGrades, maxMove, file }) {
  const { timetable } = cfg()
  if (!timetable) throw new Error('n8n TIMETABLE_WEBHOOK이 설정되지 않았습니다.')
  const fd = new FormData()
  fd.set('kind', 'timetable')
  if (name) fd.set('name', name)
  if (excludeRule) fd.set('excludeRule', excludeRule)
  if (typeof maxMove !== 'undefined') fd.set('maxMove', String(maxMove))
  if (Array.isArray(moveGrades)) fd.set('moveGrades', JSON.stringify(moveGrades))
  if (weekdayPeriods && typeof weekdayPeriods === 'object') fd.set('weekdayPeriods', JSON.stringify(weekdayPeriods))
  if (file) fd.set('file', file, file.name || 'data')
  return postMultipart(timetable, fd)
}

window.n8nClient = Object.freeze({ submitSectioning, submitTimetable })

