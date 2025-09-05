// Timetable form -> submit to admin via Netlify Functions (no n8n/colab)

function qs(sel, root=document){ return root.querySelector(sel) }
function qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)) }

const TT = {
  sheets: [], // {name, rows}
  allTeachers: [], // discovered from file [{name, info}]
  teachers: [], // exceptions [{name, info, personalMax, bannedRooms}]
  rooms: [],
}

// 이동수업 관련 제약 제거됨

async function loadFirebase() {
  try {
    const cfgStr = window.VITE_FIREBASE_CONFIG || localStorage.getItem('VITE_FIREBASE_CONFIG')
    if (!cfgStr) throw new Error('Firebase 설정이 없습니다. (VITE_FIREBASE_CONFIG)')
    const cfg = JSON.parse(cfgStr)
    const [{ initializeApp }, { getAuth }] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'),
    ])
    const app = initializeApp(cfg)
    const auth = getAuth(app); auth.useDeviceLanguage()
    return { auth }
  } catch {
    return null
  }
}

async function getIdToken(fb){
  try { const u = fb?.auth?.currentUser; if (!u) return null; return await u.getIdToken() } catch { return null }
}

function status(msg, ok=true){ const el = qs('#tt-status'); if (!el) return; el.textContent = msg||''; el.style.color = ok ? 'var(--color-text-muted)' : '#ef4444' }

async function submitTimetable(){
  try {
    const name = (qs('#tt-name')?.value || '').trim()
    const email = (qs('#tt-email')?.value || '').trim()
    const file = qs('#tt-file')?.files?.[0]
    const excludeRule = (qs('#tt-exclude')?.value || '').trim()
    const weekdayPeriods = undefined

    if (!name){ alert('담당자 이름을 입력하세요.'); return }
    if (!email){ alert('담당자 이메일을 입력하세요.'); return }
    if (!file){ alert('시간표 데이터 파일을 선택하세요.'); return }

    status('제출 준비 중...')
    const fb = await loadFirebase(); const token = await getIdToken(fb)

    // If there is no auth, store locally as demo
    if (!token){
      status('로그인이 필요합니다. 우측 상단 로그인 후 다시 시도해주세요.', false)
      alert('로그인이 필요합니다. 로그인 후 다시 제출하세요.')
      return
    }

    // 1) Create submission
    const title = `시간표 최적화 요청 - ${name}`
    const description = [
      `담당자: ${name} <${email}>`,
      `제외 규칙: ${excludeRule || '(없음)'} `
    ].join('\n')
    status('제출 생성 중...')
    const resCreate = await fetch('/.netlify/functions/submission/create', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title,
        description,
        category: '데이터',
        filesMeta: [{ name: file.name, size: file.size, contentType: file.type || 'application/octet-stream' }],
      })
    })
    if (!resCreate.ok){ const e = await resCreate.json().catch(()=>({error:{message:'제출 생성 실패'}})); throw new Error(e?.error?.message||'제출 생성 실패') }
    const created = await resCreate.json(); const sid = created.id

    // 2) Get signed upload URL and upload file
    status('파일 업로드 준비 중...')
    const upRes = await fetch('/.netlify/functions/storage/createUploadUrl', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ submissionId: sid, filename: file.name, contentType: file.type || 'application/octet-stream', size: file.size })
    })
    if (!upRes.ok){ const e = await upRes.json().catch(()=>({error:{message:'업로드 URL 생성 실패'}})); throw new Error(e?.error?.message||'업로드 URL 생성 실패') }
    const { uploadUrl } = await upRes.json()
    status('파일 업로드 중...')
    const putRes = await fetch(uploadUrl, { method: 'PUT', headers: { 'content-type': file.type || 'application/octet-stream' }, body: file })
    if (!putRes.ok) throw new Error('파일 업로드 실패')

    // 3) Save teacher constraints + special rooms (no extra file)
    try {
      await fetch('/.netlify/functions/timetable/submit', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ submissionId: sid, excludeRule, teachers: { rooms: TT.rooms, list: TT.teachers, globalMax: parseInt(qs('#tt-global-max')?.value||'0',10)||0 } })
      })
    } catch {}

    status('제출 완료. 관리자 검토 대기 중입니다.')
    alert('제출이 완료되었습니다. 관리자 검토 후 이메일로 안내드립니다.')
  } catch (err) {
    console.error(err)
    status('제출 중 오류: ' + (err?.message || '오류'), false)
    alert('제출 중 오류: ' + (err?.message || '오류'))
  }
}

function main(){
  // 이동수업 제약 없음
  const fi = qs('#tt-file'); const label = qs('#tt-file-label')
  fi?.addEventListener('change', () => { if (label) label.textContent = fi.files?.[0]?.name || '선택된 파일 없음' })
  qs('#tt-submit')?.addEventListener('click', (e)=>{ e.preventDefault(); submitTimetable() })

  // timetable: parsing + UI bindings
  fi?.addEventListener('change', async (e)=>{
    const f = e.target.files?.[0]; if (!f) return; await parseTimetableFile(f)
  })
  qs('#tt-generate')?.addEventListener('click', ()=>{
    const idx = parseInt(qs('#tt-sheet')?.value || '0', 10) || 0;
    buildTeachersFromSheet(idx)
  })
  // 시트 변경 시 자동 생성하지 않음. 사용자가 "교사 표 생성"을 누르도록 유도
  qs('#tt-room-add')?.addEventListener('click', addRoomFromInput)
  // manual add teacher
  qs('#tt-add-teacher')?.addEventListener('click', (e)=>{ e.preventDefault(); addTeacherFromSelect() })
}

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main, { once: true })
else main()

// -------------- Timetable parsing / teacher constraints --------------
async function loadScriptOnce(src, globalKey){
  if (globalKey && window[globalKey]) return window[globalKey];
  await new Promise((res, rej)=>{ const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=()=>rej(new Error('script load failed: '+src)); document.head.appendChild(s) })
  return globalKey?window[globalKey]:undefined
}

async function parseTimetableFile(file){
  const name = file.name.toLowerCase(); const isX = name.endsWith('.xlsx')||name.endsWith('.xls'); const isC = name.endsWith('.csv')
  if (!isX && !isC){ alert('XLSX/XLS 또는 CSV 파일을 올려주세요.'); return }
  if (isC){
    await loadScriptOnce('https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js','Papa')
    const text = await file.text(); const p = window.Papa.parse(text,{header:true, skipEmptyLines:true});
    TT.sheets = [{ name:'CSV', rows: p.data }];
    const sel = qs('#tt-sheet'); if (sel) sel.innerHTML = `<option value="0">CSV</option>`
    const wrap = qs('#tt-sheet-wrap'); if (wrap) wrap.style.display = 'flex'
    const gen = qs('#tt-generate'); if (gen) gen.disabled = false
    buildTeachersFromAllSheets() // 자동 수집
  } else {
    await loadScriptOnce('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', 'XLSX')
    const buf = await file.arrayBuffer(); const wb = window.XLSX.read(buf,{type:'array'})
    const sheets = []
    for (const sn of wb.SheetNames){
      const rows = window.XLSX.utils.sheet_to_json(wb.Sheets[sn],{defval:''});
      if (rows && rows.length) sheets.push({ name: sn, rows })
    }
    if (!sheets.length){ alert('모든 시트가 비어있습니다.'); return }
    TT.sheets = sheets
    const sel = qs('#tt-sheet'); sel.innerHTML = sheets.map((s,i)=>`<option value="${i}">${s.name}</option>`).join('')
    const wrap = qs('#tt-sheet-wrap'); if (wrap) wrap.style.display = 'flex'
    const gen = qs('#tt-generate'); if (gen) gen.disabled = false
    buildTeachersFromAllSheets() // 자동 수집
  }
}

function buildTeachersFromSheet(idx){
  // kept for manual refresh if needed
  buildTeachersFromAllSheets()
}

function extractTeachersFromRows(rows){
  const normalized = rows.map(r=>{ const o={}; Object.keys(r).forEach(k=>o[String(k).trim()]=r[k]); return o })
  const first = normalized[0] || {}; const keys = Object.keys(first)
  const teacherKey = keys.find(k=>/teacher|교사|선생/i.test(k)) || 'Teacher'
  const subjectKey = keys.find(k=>/subject|과목/i.test(k)) || 'Subject'
  const roomKeys = keys.filter(k=>/(특별\s*실|room|교실)/i.test(k))
  const list = []; const seen = new Set(); const roomSet = new Set()
  for (const r of normalized){
    const name = String(r[teacherKey]??'').trim(); if (!name) continue; if (seen.has(name)) continue; seen.add(name)
    const info = String(r[subjectKey]??'').trim()
    list.push({ name, info })
    for (const rk of roomKeys){ const v=r[rk]; if (v==null) continue; const s=String(v).trim(); if (!s||s==='0') continue; s.split(',').map(x=>x.trim()).filter(Boolean).forEach(x=>roomSet.add(x)) }
  }
  return { teachers: list, rooms: Array.from(roomSet) }
}

function buildTeachersFromAllSheets(){
  const map = new Map(); const roomSet = new Set(TT.rooms)
  for (const s of TT.sheets){
    const { teachers, rooms } = extractTeachersFromRows(s.rows)
    for (const t of teachers){ if (!map.has(t.name)) map.set(t.name, t) }
    rooms.forEach(r=>roomSet.add(r))
  }
  TT.allTeachers = Array.from(map.values())
  TT.rooms = Array.from(roomSet)
  renderRoomsChips(); renderTeacherPicker(); renderTeachersTable()
}

function renderRoomsChips(){
  const box = qs('#tt-room-chips'); if (!box) return; box.innerHTML = TT.rooms.map((n,i)=>`<span class="pill mini" style="background:var(--color-surface-2); padding:.1rem .4rem; border-radius:.4rem; display:inline-flex; gap:.25rem; align-items:center;">${n}<button type="button" data-del="${i}" style="border:none;background:transparent;cursor:pointer;">✕</button></span>`).join('')
  box.querySelectorAll('[data-del]')?.forEach(b=>b.addEventListener('click',e=>{ const i=parseInt(e.currentTarget.getAttribute('data-del'),10); TT.rooms.splice(i,1); renderRoomsChips(); renderTeachersTable() }))
}

function addRoomFromInput(){ const ip=qs('#tt-room-input'); const v=(ip?.value||'').trim(); if (!v) return; if (!TT.rooms.includes(v)) TT.rooms.push(v); ip.value=''; renderRoomsChips(); renderTeachersTable() }

function renderTeachersTable(){
  const body = qs('#tt-teachers-body'); if (!body) return
  // datalist for rooms
  let dl = document.getElementById('tt-rooms-dl'); if (!dl){ dl=document.createElement('datalist'); dl.id='tt-rooms-dl'; document.body.appendChild(dl) }
  dl.innerHTML = TT.rooms.map(r=>`<option value="${r}"></option>`).join('')
  body.innerHTML = TT.teachers.map((t,i)=>`
    <tr data-i="${i}">
      <td><button type="button" class="link-like" data-role="open-personal" data-i="${i}" title="개인 최대 연속 수업 설정">${t.name}</button></td>
      <td>${t.info||''}</td>
      <td><input type="number" min="0" max="10" value="${t.personalMax ?? ''}" placeholder="기본값" data-role="personal-max" class="cell-num"/></td>
      <td><input type="text" value="${(t.bannedRooms||[]).join(', ')}" list="tt-rooms-dl" placeholder="쉼표로 여러 개" data-role="rooms" style="inline-size:24rem;"/></td>
    </tr>
  `).join('')
  body.querySelectorAll('input[data-role="personal-max"]').forEach((inp,idx)=> inp.addEventListener('input', e=>{ const v=e.target.value; TT.teachers[idx].personalMax = v===''?undefined:(parseInt(v,10)||0) }))
  body.querySelectorAll('input[data-role="rooms"]').forEach((inp,idx)=> inp.addEventListener('input', e=>{ const v=String(e.target.value||'').trim(); TT.teachers[idx].bannedRooms = v? v.split(',').map(s=>s.trim()).filter(Boolean) : [] }))
}

function renderTeacherPicker(){
  const sel = qs('#tt-teacher-select'); if (!sel) return;
  const chosen = new Set(TT.teachers.map(t=>t.name))
  sel.innerHTML = TT.allTeachers
    .filter(t=>!chosen.has(t.name))
    .map(t=>`<option value="${encodeURIComponent(t.name)}">${t.name}${t.info?` — ${t.info}`:''}</option>`) 
    .join('');
}

function addTeacherFromSelect(){
  const sel = qs('#tt-teacher-select'); if (!sel) { alert('교사 목록이 없습니다. 파일을 불러오세요.'); return }
  const value = sel.value; if (!value){ alert('교사를 선택하세요.'); return }
  const name = decodeURIComponent(value)
  const src = TT.allTeachers.find(t=>t.name===name); if (!src) return;
  if (!TT.teachers.find(t=>t.name===name)){
    TT.teachers.push({ name: src.name, info: src.info, personalMax: undefined, bannedRooms: [] })
  }
  renderTeacherPicker(); renderTeachersTable();
}

function addTeacherManual(){
  const name = (qs('#tt-add-teacher-name')?.value || '').trim();
  const info = (qs('#tt-add-teacher-info')?.value || '').trim();
  if (!name){ alert('교사 이름을 입력하세요.'); return }
  TT.teachers.push({ name, info, maxConsecutive: 0, bannedRooms: [], perDayMax:{mon:0,tue:0,wed:0,thu:0,fri:0} })
  qs('#tt-add-teacher-name').value = ''
  qs('#tt-add-teacher-info').value = ''
  renderTeachersTable()
}

function ensurePerDay(t){
  if (!t.perDayMax) t.perDayMax = { mon:0, tue:0, wed:0, thu:0, fri:0 }
  return t.perDayMax
}

function openPersonalMax(idx){
  const t = TT.teachers[idx]; if (!t) return;
  TT.ui.editingIdx = idx
  const p = ensurePerDay(t)
  qs('#tt-max-teacher').textContent = `교사: ${t.name} (${t.info||''})`
  qs('#tt-max-mon').value = p.mon||0
  qs('#tt-max-tue').value = p.tue||0
  qs('#tt-max-wed').value = p.wed||0
  qs('#tt-max-thu').value = p.thu||0
  qs('#tt-max-fri').value = p.fri||0
  toggleMaxModal(true)
}

function toggleMaxModal(show){
  const m = qs('#tt-max-modal'); if (!m) return; if (show){ m.removeAttribute('hidden') } else { m.setAttribute('hidden','') }
}

function savePersonalMax(){
  const idx = TT.ui.editingIdx; if (idx==null) return;
  const t = TT.teachers[idx]; if (!t) return;
  t.perDayMax = {
    mon: parseInt(qs('#tt-max-mon').value||'0',10)||0,
    tue: parseInt(qs('#tt-max-tue').value||'0',10)||0,
    wed: parseInt(qs('#tt-max-wed').value||'0',10)||0,
    thu: parseInt(qs('#tt-max-thu').value||'0',10)||0,
    fri: parseInt(qs('#tt-max-fri').value||'0',10)||0,
  }
  toggleMaxModal(false)
}
