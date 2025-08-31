// 그룹핑(선택과목 분반) 제출 + 특이 사항 전송
import { logger } from './utils/logger.js'

const $ = (sel, root = document) => root.querySelector(sel)

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
    const [{ initializeApp }, { getAuth } ] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'),
    ])
    const app = initializeApp(cfg || { apiKey: 'demo', projectId: 'demo' })
    const auth = getAuth(app)
    auth.useDeviceLanguage()
    return { auth }
  } catch (e) {
    logger.warn('firebase load failed', e)
    return null
  }
}

async function getIdToken(fb) {
  try {
    if (!fb?.auth) return null
    const u = fb.auth.currentUser
    if (!u) return null
    return await u.getIdToken()
  } catch {
    return null
  }
}

function status(msg, ok = true) {
  const el = $('#gr-status'); if (!el) return
  el.textContent = msg || ''
  el.style.color = ok ? 'var(--color-text-muted)' : '#ef4444'
}

async function submitGrouping() {
  try {
    const name = ($('#gr-name')?.value || '').trim()
    const email = ($('#gr-email')?.value || '').trim()
    const file = $('#gr-file')?.files?.[0]
    const maxPer = parseInt($('#gr-max-per-class')?.value || '25', 10)
    const minSlots = parseInt($('#gr-min-slots')?.value || '1', 10)
    const maxSlots = parseInt($('#gr-max-slots')?.value || '3', 10)
    const notes = ($('#gr-notes')?.value || '').trim()

    if (!name) { alert('담당자 이름을 입력하세요.'); return }
    if (!email) { alert('담당자 이메일을 입력하세요.'); return }
    if (!file) { alert('데이터 파일을 선택하세요.'); return }

    status('제출 준비 중...')

    // If n8n webhook is configured, prefer sending to n8n which will
    // prepare a Colab notebook with the uploaded data and return a link.
    if (window.N8N_SECTIONING_WEBHOOK) {
      try {
        status('n8n으로 전송 중...')
        const result = await window.n8nClient.submitSectioning({
          name, email, notes,
          maxPerClass: maxPer,
          minSlots, maxSlots,
          file,
        })
        const url = result?.colab_url || result?.url || result?.open_url
        status('전송 완료. Colab 열기 준비됨')
        if (url) {
          window.open(url, '_blank', 'noopener')
          alert('Colab에서 노트북이 열립니다. "런타임"→"모두 실행"을 눌러 실행하세요.')
          return
        }
        // If n8n responded without a URL, fall back to legacy path below
        status('Colab URL이 응답에 없습니다. 서버 응답 형식을 확인하세요.', false)
      } catch (e) {
        logger.warn('n8n submission failed, falling back', e)
        status('n8n 전송 실패. 백엔드/로컬 모드로 전환합니다...', false)
      }
    }
    const fb = await loadFirebase()
    const token = await getIdToken(fb)
    // 토큰이 없거나, 함수가 실패하면 자동으로 로컬 데모 모드로 폴백합니다.

    // 1) 서버에 제출 레코드 생성
    const title = `선택과목 분반 요청 - ${name}`
    const description = `담당자: ${name} <${email}>\n분반당 최대 학생 수: ${maxPer}\n선택 슬롯: ${minSlots}~${maxSlots}\n특이 사항: ${notes || '(없음)'}`
    const body = {
      title,
      description,
      category: '데이터',
      filesMeta: [{ name: file.name, size: file.size, contentType: file.type || 'application/octet-stream' }],
      meta: {
        grouping: {
          contactName: name,
          contactEmail: email,
          maxPerClass: maxPer,
          minSlots: minSlots,
          maxSlots: maxSlots,
          notes: notes,
        }
      },
    }
    let sid = null
    let usedFallback = false
    if (token) {
      try {
        status('제출 생성 중...')
        const resCreate = await fetch('/.netlify/functions/submission/create', {
          method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify(body)
        })
        if (!resCreate.ok) throw await resCreate.json().catch(()=>({ error: { message: '제출 생성 실패' } }))
        const created = await resCreate.json()
        sid = created.id
      } catch (_) {
        usedFallback = true
      }
    } else {
      usedFallback = true
    }

    // Local fallback: store to localStorage and simulate processing
    if (usedFallback) {
      const readDemo = () => { try { return JSON.parse(localStorage.getItem('demo.submissions')||'[]') } catch { return [] } }
      const writeDemo = (arr) => localStorage.setItem('demo.submissions', JSON.stringify(arr))
      const simulateProcessing = (id) => {
        setTimeout(()=>{
          const arr1 = readDemo(); const it1 = arr1.find(x=>x.id===id); if (!it1) return;
          it1.status = 'processing'; it1.updatedAt = new Date().toISOString(); writeDemo(arr1);
          setTimeout(()=>{
            const arr2 = readDemo(); const it2 = arr2.find(x=>x.id===id); if (!it2) return;
            it2.status = 'completed'; it2.updatedAt = new Date().toISOString();
            it2.results = [{ name: 'result.txt', size: 19, storagePath: 'local/demo/result.txt', contentType: 'text/plain' }];
            writeDemo(arr2);
          }, 2000)
        }, 800)
      }
      sid = String(Date.now())
      const entry = {
        id: sid,
        ownerUid: 'local', ownerEmail: email,
        title, description, category: '데이터',
        status: 'uploaded', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        files: [{ name: file.name, size: file.size, contentType: file.type || 'application/octet-stream' }],
        results: [], messages: [],
      }
      const arr = readDemo(); arr.unshift(entry); writeDemo(arr); simulateProcessing(sid)
      status('로컬 모드로 제출되었습니다. 처리 대기 중...')
      alert('백엔드가 연결되지 않아 로컬 모드로 제출되었습니다. 배포 환경에서는 자동으로 서버에 업로드됩니다.')
      return
    }

    // 2) 업로드 URL 생성 후 업로드
    status('파일 업로드 준비 중...')
    const upRes = await fetch('/.netlify/functions/storage/createUploadUrl', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ submissionId: sid, filename: file.name, contentType: file.type || 'application/octet-stream', size: file.size })
    })
    if (upRes.ok) {
      const { uploadUrl } = await upRes.json()
      status('파일 업로드 중...')
      const putRes = await fetch(uploadUrl, { method: 'PUT', headers: { 'content-type': file.type || 'application/octet-stream' }, body: file })
      if (!putRes.ok) throw new Error('파일 업로드 실패')
      status('제출이 완료되었습니다. 처리 대기 중...')
      alert('제출이 완료되었습니다. 처리 상태는 이메일로 안내드리겠습니다.')
      return
    } else {
      // Fallback if upload URL failed after creation
      status('서버 업로드가 실패하여 로컬 모드로 전환합니다...', false)
      const readDemo = () => { try { return JSON.parse(localStorage.getItem('demo.submissions')||'[]') } catch { return [] } }
      const writeDemo = (arr) => localStorage.setItem('demo.submissions', JSON.stringify(arr))
      const simulateProcessing = (id) => {
        setTimeout(()=>{
          const arr1 = readDemo(); const it1 = arr1.find(x=>x.id===id); if (!it1) return;
          it1.status = 'processing'; it1.updatedAt = new Date().toISOString(); writeDemo(arr1);
          setTimeout(()=>{
            const arr2 = readDemo(); const it2 = arr2.find(x=>x.id===id); if (!it2) return;
            it2.status = 'completed'; it2.updatedAt = new Date().toISOString();
            it2.results = [{ name: 'result.txt', size: 19, storagePath: 'local/demo/result.txt', contentType: 'text/plain' }];
            writeDemo(arr2);
          }, 2000)
        }, 800)
      }
      const entry = {
        id: sid,
        ownerUid: 'local', ownerEmail: email,
        title, description, category: '데이터',
        status: 'uploaded', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        files: [{ name: file.name, size: file.size, contentType: file.type || 'application/octet-stream' }],
        results: [], messages: [],
      }
      const arr = readDemo(); arr.unshift(entry); writeDemo(arr); simulateProcessing(sid)
      alert('업로드 URL 생성에 실패하여 로컬 모드로 제출되었습니다. 배포 환경에서는 자동 업로드됩니다.')
      status('로컬 모드 제출 완료. 처리 대기 중...')
      return
    }
  } catch (err) {
    logger.error(err)
    status(String(err?.message || err || '오류'), false)
    alert('제출 중 오류가 발생했습니다: ' + (err?.message || '오류'))
  }
}

function main() {
  const fi = $('#gr-file')
  const label = $('#gr-file-label')
  fi?.addEventListener('change', () => { label && (label.textContent = fi.files?.[0]?.name || '선택된 파일 없음') })
  $('#gr-submit')?.addEventListener('click', submitGrouping)
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main, { once: true })
else main()
