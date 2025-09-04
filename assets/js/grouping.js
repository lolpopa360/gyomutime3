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

    // n8n/colab 연동 제거: 관리자 제출로만 처리합니다.
    const fb = await loadFirebase()
    const token = await getIdToken(fb)
    // 로그인 필수
    if (!token) { status('로그인이 필요합니다. 로그인 후 다시 제출하세요.', false); alert('로그인이 필요합니다.'); return }

    // 0) 로컬 데모 fallback 준비
    const demo = {
      read() { try { return JSON.parse(localStorage.getItem('demo.submissions')||'[]') } catch { return [] } },
      write(arr) { localStorage.setItem('demo.submissions', JSON.stringify(arr)) },
      simulateProcessing(id) {
        setTimeout(()=>{
          const arr1 = demo.read(); const it1 = arr1.find(x=>x.id===id); if (!it1) return;
          it1.status = 'processing'; it1.updatedAt = new Date().toISOString(); demo.write(arr1);
          setTimeout(()=>{
            const arr2 = demo.read(); const it2 = arr2.find(x=>x.id===id); if (!it2) return;
            it2.status = 'completed'; it2.updatedAt = new Date().toISOString();
            it2.results = [{ name: 'result.txt', size: 19, storagePath: 'local/demo/result.txt', contentType: 'text/plain' }];
            demo.write(arr2);
          }, 2000)
        }, 800)
      }
    }

    // 1) 서버에 제출 레코드 생성 (Netlify Functions)
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
    status('제출 생성 중...')
    try {
      const resCreate = await fetch('/.netlify/functions/submission/create', {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      })
      if (!resCreate.ok) throw new Error('create_failed')
      const created = await resCreate.json()
      sid = created.id
    } catch (e) {
      // Likely running without Netlify dev (e.g., 127.0.0.1:5500) → fallback to local mode
      const localId = String(Date.now())
      const entry = {
        id: localId,
        ownerUid: 'local', ownerEmail: email,
        title, description, category: '데이터',
        status: 'uploaded', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        files: [{ name: file.name, size: file.size, contentType: file.type || 'application/octet-stream' }],
        results: [], messages: [],
        meta: body.meta || {}
      }
      const arr = demo.read(); arr.unshift(entry); demo.write(arr); demo.simulateProcessing(localId)
      status('서버 연결이 없어 로컬 모드로 제출되었습니다. 처리 대기 중...', false)
      alert('개발 서버(Netlify dev)와 연결되지 않아 로컬 모드로 제출되었습니다. 배포 환경 또는 netlify dev에서 자동 업로드됩니다.')
      return
    }

    // 로컬 데모 모드 제거

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
      const entry = {
        id: sid,
        ownerUid: 'local', ownerEmail: email,
        title, description, category: '데이터',
        status: 'uploaded', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        files: [{ name: file.name, size: file.size, contentType: file.type || 'application/octet-stream' }],
        results: [], messages: [],
      }
      const arr = demo.read(); arr.unshift(entry); demo.write(arr); demo.simulateProcessing(sid)
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
