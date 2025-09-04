// Timetable form -> submit to admin via Netlify Functions (no n8n/colab)

function qs(sel, root=document){ return root.querySelector(sel) }
function qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)) }

function setDisabledMove(disabled){
  qsa('.chk-grade').forEach(cb => { cb.disabled = disabled; cb.checked = false })
  const max = qs('#max-move'); if (max){ max.disabled = disabled; max.value = '0' }
}

async function loadFirebase() {
  try {
    const embeddedCfg = {
      apiKey: "AIzaSyCtKBMC_l_YTtTIGuvWil4hAMO2SxLutnA",
      authDomain: "gyomutime-ea929.firebaseapp.com",
      projectId: "gyomutime-ea929",
      storageBucket: "gyomutime-ea929.firebasestorage.app",
      messagingSenderId: "1018950329432",
      appId: "1:1018950329432:web:c42c417a9138e0f4a0962d",
      measurementId: "G-N31BTHB5C2"
    }
    const cfgStr = window.VITE_FIREBASE_CONFIG || localStorage.getItem('VITE_FIREBASE_CONFIG')
    const cfg = cfgStr ? JSON.parse(cfgStr) : embeddedCfg
    const [{ initializeApp }, { getAuth }] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'),
    ])
    const app = initializeApp(cfg || { apiKey: 'demo', projectId: 'demo' })
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
    const weekdayPeriods = {
      mon: parseInt(qs('#tt-p-mon')?.value || '0', 10),
      tue: parseInt(qs('#tt-p-tue')?.value || '0', 10),
      wed: parseInt(qs('#tt-p-wed')?.value || '0', 10),
      thu: parseInt(qs('#tt-p-thu')?.value || '0', 10),
      fri: parseInt(qs('#tt-p-fri')?.value || '0', 10),
    }
    const maxMove = parseInt(qs('#max-move')?.value || '0', 10)
    const moveGrades = qsa('.chk-grade:checked').map(cb => cb.value)

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
      `제외 규칙: ${excludeRule || '(없음)'} `,
      `요일별 교시: ${JSON.stringify(weekdayPeriods)}`,
      `이동수업 학년: ${moveGrades.join(',') || '(없음)'} / 최대연속: ${maxMove}`
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

    status('제출 완료. 관리자 검토 대기 중입니다.')
    alert('제출이 완료되었습니다. 관리자 검토 후 이메일로 안내드립니다.')
  } catch (err) {
    console.error(err)
    status('제출 중 오류: ' + (err?.message || '오류'), false)
    alert('제출 중 오류: ' + (err?.message || '오류'))
  }
}

function main(){
  const noneBtn = qs('#move-none')
  if (noneBtn){ noneBtn.addEventListener('click', (e)=>{ e.preventDefault(); setDisabledMove(true) }) }
  const fi = qs('#tt-file'); const label = qs('#tt-file-label')
  fi?.addEventListener('change', () => { if (label) label.textContent = fi.files?.[0]?.name || '선택된 파일 없음' })
  qs('#tt-submit')?.addEventListener('click', (e)=>{ e.preventDefault(); submitTimetable() })
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main, { once: true })
else main()
