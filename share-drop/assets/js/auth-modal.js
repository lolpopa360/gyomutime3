// Lightweight auth modal with Firebase Auth (if configured)
// Falls back to localStorage-only demo if Firebase config is missing.

import { logger } from './utils/logger.js'

const ADMIN_EMAIL = 'yangchanhee11@gmail.com'
// Default admin code; can be overridden by backend config.
const DEFAULT_ADMIN_CODE = '111308'

async function loadFirebase() {
  // Try to initialize Firebase with provided config or fallback to stored config
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
    const [{ initializeApp }, { getAuth, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signOut, fetchSignInMethodsForEmail, linkWithCredential, EmailAuthProvider }] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'),
    ])
    const app = initializeApp(cfg || { apiKey: 'demo', projectId: 'demo' })
    const auth = getAuth(app)
    auth.useDeviceLanguage()
    return { auth, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signOut, fetchSignInMethodsForEmail, linkWithCredential, EmailAuthProvider }
  } catch (err) {
    logger.warn('Firebase not available; falling back to local demo', err)
    return null
  }
}

function setUser(u) {
  if (!u) localStorage.removeItem('site.user')
  else localStorage.setItem('site.user', JSON.stringify(u))
  updateNav()
}

function getUser() {
  try { return JSON.parse(localStorage.getItem('site.user') || 'null') } catch { return null }
}

function updateNav() {
  const nav = document.getElementById('site-nav')
  if (!nav) return
  const user = getUser()
  // Remove existing account actions
  nav.querySelectorAll('[data-open="login"], [data-open="register"], [data-nav-account], [data-nav-logout]').forEach(n=>n.parentElement?.remove())
  const ul = nav.querySelector('ul')
  if (!ul) return
  if (user) {
    const liAcc = document.createElement('li')
    liAcc.innerHTML = `<a href="#" data-nav-account>${user.email}</a>`
    const liLogout = document.createElement('li')
    liLogout.innerHTML = `<a href="#" data-nav-logout>로그아웃</a>`
    ul.appendChild(liAcc); ul.appendChild(liLogout)
    ul.addEventListener('click', (e) => {
      const t = e.target
      if (!(t instanceof Element)) return
      if (t.matches('[data-nav-logout]')) { e.preventDefault(); setUser(null) }
      if (t.matches('[data-nav-account]')) { e.preventDefault(); if (user.isAdmin) location.href = 'admin.html' }
    })
  } else {
    const li1 = document.createElement('li'); li1.innerHTML = '<a href="#" data-open="login">로그인</a>'
    ul.appendChild(li1)
  }
}

function openModal(mode = 'choice') {
  const modal = document.getElementById('auth-modal')
  if (!modal) return
  modal.hidden = false
  const choice = modal.querySelector('#auth-choice')
  const login = modal.querySelector('#login-form')
  const register = modal.querySelector('#register-form')
  const admin = modal.querySelector('#admin-form')
  const set = (el, show) => { if (el) { el.hidden = !show; el.style.display = show ? '' : 'none' } }
  set(choice, mode === 'choice')
  set(login, mode === 'login')
  set(register, mode === 'register')
  set(admin, mode === 'admin')
  const title = modal.querySelector('#auth-title')
  if (title) title.textContent = mode === 'register' ? '회원가입' : (mode === 'admin' ? '관리자 인증' : (mode === 'login' ? '로그인' : '계정'))
}

function closeModal() {
  const modal = document.getElementById('auth-modal'); if (modal) modal.hidden = true
}

async function main() {
  const fb = await loadFirebase()

  document.addEventListener('click', (e) => {
    const t = e.target
    if (!(t instanceof Element)) return
    if (t.closest('[data-open="login"]')) { e.preventDefault(); openModal('choice') }
    if (t.closest('[data-open="register"]')) { e.preventDefault(); openModal('choice') }
    if (t.closest('[data-open-admin]')) { e.preventDefault(); openModal('admin') }
    if (t.closest('[data-close="modal"]')) { e.preventDefault(); closeModal() }
    const sw = t.closest('[data-switch]')?.getAttribute('data-switch')
    if (sw) { e.preventDefault(); openModal(sw) }
    const ch = t.closest('[data-choice]')?.getAttribute('data-choice')
    if (ch) { e.preventDefault(); openModal(ch) }
  })

  // Email/Password login
  const showErr = (id, msg) => { const el = document.getElementById(id); if (el){ el.textContent = msg; el.style.display = msg ? 'block' : 'none' } }

  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const email = String(fd.get('email')||'')
    const password = String(fd.get('password')||'')
    try {
      if (fb?.signInWithEmailAndPassword && fb?.auth?.app?.options?.apiKey !== 'demo') {
        await fb.signInWithEmailAndPassword(fb.auth, email, password)
      }
      const isAdmin = email === ADMIN_EMAIL
      setUser({ email, isAdmin })
      closeModal()
    } catch (err) {
      showErr('auth-error', '로그인 실패: ' + (err?.message || '오류'))
    }
  })

  // Register
  document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const email = String(fd.get('email')||'')
    const password = String(fd.get('password')||'')
    try {
      if (fb?.createUserWithEmailAndPassword && fb?.auth?.app?.options?.apiKey !== 'demo') {
        // Prevent duplicate accounts by checking existing sign-in methods
        const methods = await fb.fetchSignInMethodsForEmail(fb.auth, email)
        if (methods && methods.length > 0) throw new Error('이미 존재하는 계정입니다. 로그인 해주세요.')
        await fb.createUserWithEmailAndPassword(fb.auth, email, password)
      }
      setUser({ email, isAdmin: email === ADMIN_EMAIL })
      closeModal()
    } catch (err) {
      showErr('auth-error-reg', '회원가입 실패: ' + (err?.message || '오류'))
    }
  })

  // Google
  const doGoogle = async () => {
    try {
      if (fb?.signInWithPopup && fb?.GoogleAuthProvider) {
        const prov = new fb.GoogleAuthProvider()
        let result
        try {
          result = await fb.signInWithPopup(fb.auth, prov)
        } catch (e) {
          // Handle account-exists-with-different-credential
          if (e?.code === 'auth/account-exists-with-different-credential') {
            alert('이미 다른 로그인 방식으로 가입된 이메일입니다. 이메일/비밀번호 로그인을 이용해주세요.')
            return
          }
          throw e
        }
        const email = result?.user?.email || 'user@google'
        setUser({ email, isAdmin: email === ADMIN_EMAIL })
        closeModal()
      } else {
        alert('Firebase 설정이 필요합니다.')
      }
    } catch (err) {
      alert('Google 로그인 실패: ' + (err?.message || '오류'))
    }
  }
  document.getElementById('google-login')?.addEventListener('click', doGoogle)
  document.getElementById('google-register')?.addEventListener('click', doGoogle)

  // Admin gate
  async function verifyAdminWithBackend(code) {
    try {
      if (!fb?.auth) throw new Error('no_auth')
      const u = fb.auth.currentUser
      if (!u) throw new Error('로그인이 필요합니다. 먼저 로그인해주세요.')
      if ((u.email || '') !== ADMIN_EMAIL) throw new Error('관리자 이메일로 로그인해야 합니다.')
      const idToken = await u.getIdToken()
      const resp = await fetch('/.netlify/functions/auth/verifyAdmin', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ code })
      })
      if (!resp.ok) throw new Error((await resp.json()).error?.message || '실패')
      return true
    } catch (err) {
      logger.warn('verifyAdminWithBackend failed, fallback to local check', err)
      return false
    }
  }

  document.getElementById('admin-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const email = String(fd.get('email')||'')
    const code = String(fd.get('adminCode')||'')
    let ok = false
    // Try backend verification first
    ok = await verifyAdminWithBackend(code)
    // Fallback to local default code if backend not available
    if (!ok && email === ADMIN_EMAIL && code === DEFAULT_ADMIN_CODE) ok = true
    if (ok) {
      setUser({ email: email || ADMIN_EMAIL, isAdmin: true })
      closeModal()
      location.href = 'admin.html'
    } else {
      alert('관리자 인증 실패')
    }
  })

  updateNav()

  // Templates default seed if missing
  try {
    if (!localStorage.getItem('app.templates')) {
      const csv1 = '교사,과목,가능시간\n김선생,수학,월1;화2;수3\n;' 
      const csv2 = '학생ID,수학심화,물리학,화학\n2024001,1,0,1\n2024002,0,1,0\n'
      const seed = [
        { id: 'timetable', title: '시간표 데이터 예시 (CSV)', description: '교사/교실/가능시간 등 구성', filename: 'timetable_template.csv', mime: 'text/csv', data: btoa(unescape(encodeURIComponent(csv1))) },
        { id: 'grouping', title: '선택과목 분반 예시 (CSV)', description: '학생 선호도 매트릭스', filename: 'grouping_template.csv', mime: 'text/csv', data: btoa(unescape(encodeURIComponent(csv2))) },
      ]
      localStorage.setItem('app.templates', JSON.stringify(seed))
    }
  } catch {}

  // Render downloads on landing
  async function renderTemplates() {
    const mount = document.getElementById('template-list'); if (!mount) return

    // 1) Load local (admin-set) templates from localStorage
    let localArr = []
    try { localArr = JSON.parse(localStorage.getItem('app.templates') || '[]') } catch { localArr = [] }

    // 2) Load public templates manifest (shared for all users)
    let manifestArr = []
    try {
      const resp = await fetch('assets/templates/manifest.json', { cache: 'no-store' })
      if (resp.ok) manifestArr = await resp.json()
    } catch {}

    // 3) Merge (local overrides manifest on id collision)
    const byId = {}
    for (const t of manifestArr || []) { const k = String(t.id || t.filename || t.url || Math.random()); byId[k] = t }
    for (const t of localArr || []) { const k = String(t.id || t.filename || t.url || Math.random()); byId[k] = { ...(byId[k] || {}), ...t } }
    const arr = Object.values(byId)

    if (!arr.length) { mount.innerHTML = '<p class="muted">등록된 양식이 없습니다.</p>'; return }

    mount.innerHTML = arr.map(t => `
      <article class="card">
        <h3 style="margin:0 0 .25rem 0; font-size:var(--fs-500);">${t.title || t.filename || '데이터 양식'}</h3>
        <p class="muted">${t.description || ''}</p>
        <div style="margin-top:.5rem;">
          <button class="btn btn--primary" data-dl="${t.id || t.filename || t.url}">다운로드</button>
        </div>
      </article>
    `).join('')

    mount.querySelectorAll('[data-dl]')?.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-dl')
        const t = arr.find(x=> String(x.id || x.filename || x.url) === String(id))
        if (!t) return
        if (t.url) {
          const a = document.createElement('a'); a.href = t.url; a.download = t.filename || ''; a.click()
          return
        }
        if (t.data) {
          try {
            // Decode base64 to bytes for correctness
            const b64 = t.data
            const bin = atob(b64)
            const len = bin.length
            const bytes = new Uint8Array(len)
            for (let i=0; i<len; i++) bytes[i] = bin.charCodeAt(i)
            const blob = new Blob([bytes], { type: t.mime || 'application/octet-stream' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a'); a.href = url; a.download = t.filename || 'template.dat'; a.click()
            setTimeout(()=> URL.revokeObjectURL(url), 1000)
          } catch {}
        }
      })
    })
  }

  renderTemplates()
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main, { once: true })
else main()
