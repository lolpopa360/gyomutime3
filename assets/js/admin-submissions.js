// Admin submissions console (vanilla JS)

const ADMIN_EMAIL = 'yangchanhee11@gmail.com'

function $(sel, root=document){ return root.querySelector(sel) }

function setYear(){ const el = $('#year'); if (el) el.textContent = String(new Date().getFullYear()) }

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
    const [{ initializeApp }, { getAuth, onAuthStateChanged }, { getFirestore, collection, query, orderBy, onSnapshot } ] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'),
    ])
    const app = initializeApp(cfg || { apiKey: 'demo', projectId: 'demo' })
    const auth = getAuth(app); auth.useDeviceLanguage()
    const db = getFirestore(app)
    return { auth, onAuthStateChanged, db, collection, query, orderBy, onSnapshot }
  } catch {
    return null
  }
}

async function getIdToken(auth){ try { const u = auth?.currentUser; if (!u) return null; return await u.getIdToken(true) } catch { return null } }

function fmtTime(t){ try { const d = t?.toDate ? t.toDate() : new Date(t); return new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium', timeStyle:'short'}).format(d) } catch { return '' } }

function renderGuard(message){ const g=$('#admin-guard'); if (!g) return; g.style.display='block'; g.innerHTML = `
  <div style="display:flex;flex-direction:column;gap:.5rem;">
    <p>${message}</p>
    <p class="muted">• 관리자 이메일(${ADMIN_EMAIL})로 로그인 후, 관리자 인증을 완료하세요.</p>
    <div><a class="btn" href="#" data-open="login">로그인 열기</a> <a class="btn" href="index.html">홈으로</a></div>
  </div>` }

function renderList(items){
  const list = $('#subs-list'); if (!list) return
  if (!items.length){ list.innerHTML = '<p class="muted">제출이 없습니다.</p>'; return }
  list.innerHTML = `
    <ul style="list-style:none;padding:0;display:grid;gap:.6rem;">
      ${items.map(it => `
        <li class="card" style="padding: .75rem;">
          <div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;">
            <div>
              <div style="font-weight:600;">${it.title||''}</div>
              <div class="muted">${it.ownerEmail||''} • 상태: ${it.status}</div>
              <div class="muted" style="font-size:.85em;">${fmtTime(it.createdAt)}${it.updatedAt? ' • ' + fmtTime(it.updatedAt):''}</div>
            </div>
            <div style="display:flex;gap:.4rem;flex-wrap:wrap;">
              ${Array.isArray(it.results) ? it.results.map(r => `<button class="btn" data-dl="${r.storagePath}">결과 다운로드</button>`).join('') : ''}
              <button class="btn" data-status="processing" data-id="${it.id}">처리중</button>
              <button class="btn" data-status="completed" data-id="${it.id}">완료</button>
              <button class="btn" data-status="rejected" data-id="${it.id}">반려</button>
              <button class="btn" data-upload="${it.id}">결과 업로드</button>
            </div>
          </div>
          <details style="margin-top:.5rem;">
            <summary>설명</summary>
            <pre style="white-space:pre-wrap; font-family:inherit; margin-top:.5rem;">${(it.description||'').replace(/[&<>]/g, s=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[s]))}</pre>
          </details>
        </li>
      `).join('')}
    </ul>`
}

async function main(){
  setYear()
  const fb = await loadFirebase(); if (!fb) { renderGuard('Firebase 초기화 실패'); return }
  const { auth, onAuthStateChanged, db, collection, query, orderBy, onSnapshot } = fb

  let settled = false
  const guardTimer = setTimeout(() => {
    if (!settled) renderGuard('로그인이 필요합니다.')
  }, 2000)

  onAuthStateChanged(auth, async (user) => {
    if (!user){ return }
    settled = true; clearTimeout(guardTimer)
    let idTokenResult = await user.getIdTokenResult(true).catch(()=>null)
    let role = idTokenResult?.claims?.role
    if (role !== 'admin'){
      // Try to self-bootstrap admin if email matches configured admin
      try {
        const email = user.email || ''
        const resp = await fetch('/.netlify/functions/auth/bootstrapAdmin', {
          method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${await user.getIdToken()}` }, body: '{}'
        })
        if (resp.ok){ await user.getIdToken(true); idTokenResult = await user.getIdTokenResult(true); role = idTokenResult?.claims?.role }
      } catch {}
    }
    if (role !== 'admin') { renderGuard('관리자 권한이 없습니다. 관리자 인증이 필요합니다.'); return }

    $('#admin-guard').style.display='none'; const panel = $('#subs-panel'); panel.style.display='block'

    // Live list
    const q = query(collection(db, 'submissions'), orderBy('createdAt','desc'))
    let items = []
    onSnapshot(q, snap => { items = snap.docs.map(d => ({ id: d.id, ...d.data() })); applyFiltersAndRender(items) })

    function applyFiltersAndRender(all){
      const fStatus = $('#filter-status')?.value || ''
      const qText = ($('#filter-q')?.value || '').trim().toLowerCase()
      const view = all.filter(it => {
        if (fStatus && it.status !== fStatus) return false
        if (!qText) return true
        return String(it.title||'').toLowerCase().includes(qText) || String(it.ownerEmail||'').toLowerCase().includes(qText)
      })
      renderList(view)
    }

    $('#filter-status')?.addEventListener('change', ()=>applyFiltersAndRender(items))
    $('#filter-q')?.addEventListener('input', ()=>applyFiltersAndRender(items))

    // Actions
    document.addEventListener('click', async (e) => {
      const t = e.target; if (!(t instanceof Element)) return
      const id = t.getAttribute('data-id')
      const st = t.getAttribute('data-status')
      const dl = t.getAttribute('data-dl')
      const up = t.getAttribute('data-upload')
      const token = await getIdToken(auth)
      if (!token){ alert('토큰 없음'); return }
      try {
        if (st && id){
          const resp = await fetch('/.netlify/functions/submission/updateStatus', {
            method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
            body: JSON.stringify({ submissionId: id, status: st })
          })
          if (!resp.ok) throw new Error((await resp.json()).error?.message || '상태 변경 실패')
        }
        if (dl){
          const resp = await fetch('/.netlify/functions/storage/createDownloadUrl', {
            method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
            body: JSON.stringify({ storagePath: dl })
          })
          if (!resp.ok) throw new Error((await resp.json()).error?.message || '다운로드 링크 생성 실패')
          const { downloadUrl } = await resp.json(); window.open(downloadUrl, '_blank', 'noopener')
        }
        if (up){
          const inp = document.createElement('input'); inp.type='file'; inp.multiple=false
          inp.onchange = async () => {
            const f = inp.files?.[0]; if (!f) return
            const r = await fetch('/.netlify/functions/submission/appendResult', {
              method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
              body: JSON.stringify({ submissionId: up, filename: f.name, contentType: f.type || 'application/octet-stream', size: f.size })
            })
            if (!r.ok) throw new Error((await r.json()).error?.message || '결과 업로드 준비 실패')
            const { uploadUrl } = await r.json()
            await fetch(uploadUrl, { method: 'PUT', headers: { 'content-type': f.type || 'application/octet-stream' }, body: f })
            alert('결과 업로드 완료')
          }
          inp.click()
        }
      } catch (err){ alert(err?.message || '오류') }
    })

    // CSV export
    $('#export-csv')?.addEventListener('click', () => {
      const headers = ['id','ownerEmail','title','status','category','createdAt']
      const rows = items.map(it => [it.id, it.ownerEmail||'', it.title||'', it.status||'', it.category||'', fmtTime(it.createdAt)])
      const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='submissions.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(url), 1000)
    })
  })
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main, { once:true })
else main()
