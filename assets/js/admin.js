// 관리자 페이지 스크립트 (순수 JS + localStorage)

const KEYS = {
  auth: 'app.auth',
  notices: 'app.announcements',
  events: 'app.events',
  users: 'app.users',
  settings: 'app.settings',
  templates: 'app.templates',
};

// -------- Storage helpers --------
const read = (k, fallback = null) => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch (_) { return fallback; }
};
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const readArray = (k) => { const v = read(k, []); return Array.isArray(v) ? v : []; };

// -------- Auth (demo only) --------
const ADMIN_EMAIL = 'yangchanhee11@gmail.com'

function getSessionUser() {
  try { return JSON.parse(localStorage.getItem('site.user') || 'null') } catch { return null }
}
function isAdminSession() {
  const u = getSessionUser();
  if (!u || !u.email) return false;
  if (u.email === ADMIN_EMAIL) return true;
  try {
    const arr = JSON.parse(localStorage.getItem('app.users') || '[]');
    return Array.isArray(arr) && arr.some(x => String(x?.email || '').toLowerCase() === String(u.email).toLowerCase() && String(x?.role) === '관리자');
  } catch { return false; }
}
function logout() { localStorage.removeItem('site.user'); location.href = 'index.html'; }

// -------- UI helpers --------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function card(inner) { return `<div class="card">${inner}</div>`; }

function renderLogin(mount) {
  mount.innerHTML = card(`
    <div style="max-width:600px;margin-inline:auto;">
      <h2 style="font-size:var(--fs-600);">관리자 인증 필요</h2>
      <p class="muted" style="margin-top:.5rem;">관리자 콘솔은 제한된 사용자만 접근할 수 있습니다. 홈페이지 우측 상단의 로그인에서 <strong>${ADMIN_EMAIL}</strong>로 로그인한 뒤, 관리자 인증을 진행해주세요.</p>
      <div style="margin-top:1rem;display:flex;gap:.5rem;">
        <a class="btn btn--primary" href="index.html">홈으로 이동</a>
      </div>
    </div>
  `);
}

function renderTabs() {
  return `
    <div class="card" style="padding:0;overflow:hidden;">
      <div style="display:flex;flex-wrap:wrap;gap:.25rem;padding:.5rem;border-bottom:1px solid var(--color-border);background:var(--color-surface);">
        <button class="btn" data-tab="dashboard">대시보드</button>
        <button class="btn" data-tab="notices">공지사항 관리</button>
        <button class="btn" data-tab="events">일정 관리</button>
        <button class="btn" data-tab="users">사용자 관리</button>
        <button class="btn" data-tab="settings">사이트 설정</button>
        <button class="btn" data-tab="templates">데이터 양식</button>
      </div>
      <div id="tab-panel" style="padding:var(--space-5);"></div>
    </div>`;
}

function renderDashboard(panel) {
  const notices = readArray(KEYS.notices);
  const events = readArray(KEYS.events);
  const users = readArray(KEYS.users);
  panel.innerHTML = `
    <div class="admin-grid">
      ${card(`
        <h3>요약</h3>
        <ul style="list-style:none;padding:0;margin-top:.75rem;display:grid;gap:.5rem;">
          <li>공지사항: <strong>${notices.length}</strong>건</li>
          <li>일정: <strong>${events.length}</strong>건</li>
          <li>사용자: <strong>${users.length}</strong>명</li>
        </ul>
      `)}
      ${card(`
        <h3>가이드</h3>
        <ol style="margin-top:.75rem;">
          <li>상단 탭에서 관리 영역을 선택하세요.</li>
          <li>항목을 추가/수정/삭제하면 localStorage에 저장됩니다.</li>
          <li>공개 페이지(index.html)에 즉시 반영됩니다.</li>
        </ol>
      `)}
    </div>
  `;
}

function upsertById(list, item) {
  const idx = list.findIndex(x => x.id === item.id);
  if (idx >= 0) list[idx] = item; else list.push(item);
  return list;
}

// ---- Firebase auth helper (for calling Netlify functions) ----
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
    };
    const cfgStr = window.VITE_FIREBASE_CONFIG || localStorage.getItem('VITE_FIREBASE_CONFIG');
    const cfg = cfgStr ? JSON.parse(cfgStr) : embeddedCfg;
    const [{ initializeApp }, { getAuth }] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'),
    ]);
    const app = initializeApp(cfg || { apiKey: 'demo', projectId: 'demo' });
    const auth = getAuth(app); auth.useDeviceLanguage();
    return { auth };
  } catch (_) { return null; }
}
async function getIdToken() {
  try {
    const fb = await loadFirebase();
    const u = fb?.auth?.currentUser;
    if (!u) return null;
    return await u.getIdToken();
  } catch { return null; }
}

// ---- Notices ----
function renderNoticesTab(panel) {
  const notices = readArray(KEYS.notices);
  panel.innerHTML = `
    <div class="admin-grid">
      ${card(`
        <h3>공지 추가/수정</h3>
        <form id="notice-form" class="admin-form" style="display:grid;gap:.75rem;">
          <input type="hidden" name="id" />
          <label>제목<input name="title" required /></label>
          <label>날짜<input name="date" type="date" /></label>
          <label>내용<textarea name="content" rows="4" placeholder="내용을 입력하세요"></textarea></label>
          <label style="display:flex;align-items:center;gap:.5rem;">
            <input type="checkbox" name="pinned" /> 상단 고정
          </label>
          <div style="display:flex;gap:.5rem;">
            <button class="btn btn--primary" type="submit">저장</button>
            <button class="btn" type="reset">초기화</button>
          </div>
        </form>
      `)}
      ${card(`
        <h3>공지 목록</h3>
        <div id="notice-list-admin" style="margin-top: .75rem;"></div>
      `)}
    </div>
  `;

  const listMount = $('#notice-list-admin', panel);
  const renderList = () => {
    const current = readArray(KEYS.notices).slice().sort((a,b)=> (b?.pinned===true)-(a?.pinned===true) || (new Date(b?.date||0)-new Date(a?.date||0)));
    if (!current.length) {
      listMount.innerHTML = '<p style="color:var(--color-text-muted);">등록된 공지가 없습니다.</p>';
      return;
    }
    listMount.innerHTML = `
      <ul style="list-style:none;padding:0;display:grid;gap:.5rem;">
        ${current.map(n => `
          <li style="display:flex;justify-content:space-between;gap:1rem;border:1px solid var(--color-border);border-radius:.5rem;padding:.6rem .75rem;background:var(--color-surface-2);">
            <div style="display:flex;flex-direction:column;gap:.25rem;">
              <strong>${n.title ?? ''}</strong>
              <small style="color:var(--color-text-muted);">${n.date ?? ''} ${n.pinned ? '• 상단고정' : ''}</small>
            </div>
            <div style="display:flex;gap:.35rem;">
              <button class="btn" data-edit="${n.id}">수정</button>
              <button class="btn" data-del="${n.id}">삭제</button>
            </div>
          </li>`).join('')}
      </ul>`;
  };
  renderList();

  panel.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const del = t.getAttribute('data-del');
    const edit = t.getAttribute('data-edit');
    if (del) {
      const arr = readArray(KEYS.notices).filter(x => String(x.id) !== String(del));
      write(KEYS.notices, arr);
      renderList();
      return;
    }
    if (edit) {
      const n = readArray(KEYS.notices).find(x => String(x.id) === String(edit));
      if (!n) return;
      const f = $('#notice-form', panel);
      f.id.value = n.id;
      f.title.value = n.title ?? '';
      f.date.value = n.date ?? '';
      f.content.value = n.content ?? '';
      f.pinned.checked = Boolean(n.pinned);
    }
  });

  $('#notice-form', panel)?.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const fd = new FormData(f);
    const id = fd.get('id') || String(Date.now());
    const item = {
      id: String(id),
      title: String(fd.get('title') || ''),
      date: String(fd.get('date') || ''),
      content: String(fd.get('content') || ''),
      pinned: f.pinned.checked,
    };
    const arr = upsertById(readArray(KEYS.notices), item);
    write(KEYS.notices, arr);
    f.reset();
    renderList();
  });
}

// ---- Events ----
function renderEventsTab(panel) {
  panel.innerHTML = `
    <div class="admin-grid">
      ${card(`
        <h3>일정 추가/수정</h3>
        <form id="event-form" class="admin-form" style="display:grid;gap:.75rem;">
          <input type="hidden" name="id" />
          <label>제목<input name="title" required /></label>
          <label>날짜<input name="date" type="date" required /></label>
          <label>설명<textarea name="description" rows="3" placeholder="설명을 입력하세요"></textarea></label>
          <div style="display:flex;gap:.5rem;">
            <button class="btn btn--primary" type="submit">저장</button>
            <button class="btn" type="reset">초기화</button>
          </div>
        </form>
      `)}
      ${card(`
        <h3>일정 목록</h3>
        <div id="event-list-admin" style="margin-top:.75rem;"></div>
      `)}
    </div>
  `;

  const mount = $('#event-list-admin', panel);
  const renderList = () => {
    const arr = readArray(KEYS.events).slice().sort((a,b)=> new Date(a?.date||0)-new Date(b?.date||0));
    if (!arr.length) { mount.innerHTML = '<p style="color:var(--color-text-muted);">등록된 일정이 없습니다.</p>'; return; }
    mount.innerHTML = `
      <ul style="list-style:none;padding:0;display:grid;gap:.5rem;">
        ${arr.map(e => `
          <li style="display:flex;justify-content:space-between;gap:1rem;border:1px solid var(--color-border);border-radius:.5rem;padding:.6rem .75rem;background:var(--color-surface-2);">
            <div style="display:flex;flex-direction:column;gap:.25rem;">
              <strong>${e.title ?? ''}</strong>
              <small style="color:var(--color-text-muted);">${e.date ?? ''}</small>
            </div>
            <div style="display:flex;gap:.35rem;">
              <button class="btn" data-edit="${e.id}">수정</button>
              <button class="btn" data-del="${e.id}">삭제</button>
            </div>
          </li>`).join('')}
      </ul>`;
  };
  renderList();

  panel.addEventListener('click', (ev) => {
    const t = ev.target;
    if (!(t instanceof Element)) return;
    const del = t.getAttribute('data-del');
    const edit = t.getAttribute('data-edit');
    if (del) {
      write(KEYS.events, readArray(KEYS.events).filter(x => String(x.id) !== String(del)));
      renderList();
      return;
    }
    if (edit) {
      const e = readArray(KEYS.events).find(x => String(x.id) === String(edit));
      if (!e) return;
      const f = $('#event-form', panel);
      f.id.value = e.id;
      f.title.value = e.title ?? '';
      f.date.value = e.date ?? '';
      f.description.value = e.description ?? '';
    }
  });

  $('#event-form', panel)?.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const fd = new FormData(f);
    const id = fd.get('id') || String(Date.now());
    const item = {
      id: String(id),
      title: String(fd.get('title') || ''),
      date: String(fd.get('date') || ''),
      description: String(fd.get('description') || ''),
    };
    const arr = upsertById(readArray(KEYS.events), item);
    write(KEYS.events, arr);
    f.reset();
    renderList();
  });
}

// ---- Templates (downloadable sample files) ----
function renderTemplatesTab(panel) {
  panel.innerHTML = `
    <div class="admin-grid">
      ${card(`
        <h3>양식 추가/수정</h3>
        <form id="tpl-form" class="admin-form" style="display:grid;gap:.75rem;">
          <input type="hidden" name="id" />
          <label>제목<input name="title" required placeholder="시간표 데이터 예시 (CSV)"/></label>
          <label>설명<textarea name="description" rows="3" placeholder="간단한 설명"></textarea></label>
          <label>파일 업로드<input name="file" type="file" /></label>
          <div style="display:flex;gap:.5rem;">
            <button class="btn btn--primary" type="submit">저장</button>
            <button class="btn" type="reset">초기화</button>
          </div>
        </form>
      `)}
      ${card(`
        <h3>양식 목록</h3>
        <div id="tpl-list" style="margin-top:.75rem;"></div>
      `)}
    </div>
  `;

  const readTpl = () => readArray(KEYS.templates)
  const writeTpl = (arr) => write(KEYS.templates, arr)

  const renderList = () => {
    const arr = readTpl()
    if (!arr.length) { $('#tpl-list', panel).innerHTML = '<p style="color:var(--color-text-muted);">등록된 양식이 없습니다.</p>'; return }
    $('#tpl-list', panel).innerHTML = `
      <ul style="list-style:none;padding:0;display:grid;gap:.5rem;">
        ${arr.map(t => `
          <li style="display:flex;justify-content:space-between;gap:1rem;border:1px solid var(--color-border);border-radius:.5rem;padding:.6rem .75rem;background:var(--color-surface-2);">
            <div style="display:flex;flex-direction:column;gap:.25rem;">
              <strong>${t.title ?? ''}</strong>
              <small style="color:var(--color-text-muted);">${t.filename ?? ''}</small>
            </div>
            <div style="display:flex;gap:.35rem;">
              <button class="btn" data-dl="${t.id}">다운로드</button>
              <button class="btn" data-edit="${t.id}">수정</button>
              <button class="btn" data-del="${t.id}">삭제</button>
            </div>
          </li>`).join('')}
      </ul>`
  }
  renderList()

  panel.addEventListener('click', (e) => {
    const t = e.target
    if (!(t instanceof Element)) return
    const id = t.getAttribute('data-del') || t.getAttribute('data-edit') || t.getAttribute('data-dl')
    if (!id) return
    const arr = readTpl()
    const item = arr.find(x=> String(x.id)===String(id))
    if (t.hasAttribute('data-del')) { writeTpl(arr.filter(x=> String(x.id)!==String(id))); renderList(); return }
    if (t.hasAttribute('data-dl')) {
      if (!item) return
      const blob = new Blob([decodeURIComponent(escape(atob(item.data)))], { type: item.mime || 'application/octet-stream' })
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=item.filename||'template.dat'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1e3)
      return
    }
    if (t.hasAttribute('data-edit') && item) {
      const f = $('#tpl-form', panel)
      f.id.value = item.id
      f.title.value = item.title || ''
      f.description.value = item.description || ''
      alert('파일을 교체하려면 새 파일을 선택 후 저장하세요.')
    }
  })

  $('#tpl-form', panel)?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const f = e.currentTarget
    const fd = new FormData(f)
    const id = String(fd.get('id') || Date.now())
    const prev = readTpl().find(x=> String(x.id)===id)
    const file = f.file?.files?.[0]
    let item
    if (file) {
      const buf = await file.arrayBuffer()
      const data = btoa(String.fromCharCode.apply(null, new Uint8Array(buf)))
      item = { id, title: String(fd.get('title')||''), description: String(fd.get('description')||''), filename: file.name, mime: file.type || 'application/octet-stream', data }
    } else if (prev) {
      item = { ...prev, title: String(fd.get('title')||prev.title||''), description: String(fd.get('description')||prev.description||'') }
    } else {
      alert('새 양식을 추가하려면 파일을 선택하세요.');
      return
    }
    const arr = readTpl();
    const idx = arr.findIndex(x=> String(x.id)===id); if (idx>=0) arr[idx]=item; else arr.push(item)
    writeTpl(arr); f.reset(); renderList()
  })
}

// ---- Users ----
function renderUsersTab(panel) {
  panel.innerHTML = `
    <div class="admin-grid">
      ${card(`
        <h3>사용자 추가 (수동)</h3>
        <form id=\"user-form\" class=\"admin-form\" style=\"display:grid;gap:.75rem;\">
          <label>이메일<input name=\"email\" type=\"email\" required placeholder=\"admin@example.com\" /></label>
          <label>이름<input name=\"name\" placeholder=\"이름(선택)\" /></label>
          <label>역할<select name=\"role\"><option>관리자</option><option>에디터</option><option>뷰어</option></select></label>
          <button class=\"btn btn--primary\" type=\"submit\">추가</button>
        </form>
      `)}
      ${card(`
        <h3>현재 사용자 (Firebase)</h3>
        <form id="user-search-form" class="admin-form" style="display:grid;gap:.5rem;grid-template-columns:1fr auto;align-items:center;">
          <input id="user-search-q" placeholder="이메일 또는 이름으로 검색" />
          <button class="btn" type="submit">검색</button>
        </form>
        <div id="user-search-info" class="muted" style="margin-top:.25rem;"></div>
        <div id="user-search-results" style="margin-top:.5rem;"></div>
      `)}
      ${card(`
        <h3>사용자 목록</h3>
        <div id="user-list-admin" style="margin-top:.75rem;"></div>
      `)}
    </div>
  `;

  // Local list rendering
  const mount = $('#user-list-admin', panel);
  const renderLocal = () => {
    const arr = readArray(KEYS.users);
    if (!arr.length) { mount.innerHTML = '<p style="color:var(--color-text-muted);">등록된 사용자가 없습니다.</p>'; return; }
    mount.innerHTML = `
      <ul style="list-style:none;padding:0;display:grid;gap:.5rem;">
        ${arr.map(u => `
          <li style="display:flex;justify-content:space-between;gap:1rem;border:1px solid var(--color-border);border-radius:.5rem;padding:.6rem .75rem;background:var(--color-surface-2);">
            <div><strong>${u.email || ''}</strong> ${u.name ? `<small class=\"muted\" style=\"margin-left:.35rem;\">${u.name}</small>` : ''} <small style=\"color:var(--color-text-muted);\">(${u.role})</small></div>
            <div style="display:flex;gap:.35rem;">
              <button class="btn" data-del="${u.id}">삭제</button>
            </div>
          </li>`).join('')}
      </ul>`;
  };
  renderLocal();

  // Local list interactions and add from search results
  panel.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const del = t.getAttribute('data-del');
    const add = t.closest('[data-add-user]');
    if (del) {
      write(KEYS.users, readArray(KEYS.users).filter(x => String(x.id) !== String(del)));
      renderLocal();
      return;
    }
    if (add) {
      const name = add.getAttribute('data-name') || '';
      const email = add.getAttribute('data-email') || '';
      const role = add.getAttribute('data-role') || '뷰어';
      const arr = readArray(KEYS.users);
      arr.push({ id: String(Date.now()), email, name, role });
      write(KEYS.users, arr);
      renderLocal();
    }
  });

  // Manual add submit
  $('#user-form', panel)?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const arr = readArray(KEYS.users);
    const email = String(fd.get('email')||'').trim();
    if (!email) { alert('이메일을 입력하세요.'); return; }
    if (arr.some(x => String(x.email||'').toLowerCase() === email.toLowerCase())) { alert('이미 등록된 이메일입니다.'); return; }
    arr.push({ id: String(Date.now()), email, name: String(fd.get('name')||''), role: String(fd.get('role')||'뷰어') });
    write(KEYS.users, arr);
    e.currentTarget.reset();
    renderLocal();
  });

  // Firebase search wiring
  const resultsMount = $('#user-search-results', panel);
  const info = $('#user-search-info', panel);

  async function fetchUsers({ q = '', pageToken = '', limit = 20 } = {}) {
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Firebase 로그인 필요 (관리자 이메일)');
      const resp = await fetch('/.netlify/functions/users/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ q, pageToken, limit })
      });
      const data = await resp.json().catch(()=>({}));
      if (!resp.ok) throw new Error(data?.error?.message || '요청 실패');
      return data;
    } catch (err) {
      info.textContent = '현재 사용자 목록을 불러오지 못했습니다: ' + (err?.message || '오류');
      resultsMount.innerHTML = '';
      return { users: [], nextPageToken: null };
    }
  }

  function renderResults(items = [], nextPageToken = null, q = '') {
    if (!items.length) {
      resultsMount.innerHTML = '<p class="muted">검색 결과가 없습니다.</p>';
      return;
    }
    resultsMount.innerHTML = `
      <ul style="list-style:none;padding:0;display:grid;gap:.5rem;">
        ${items.map(u => {
          const name = (u.displayName || u.email || '').replace(/</g,'&lt;');
          const role = u.role || '일반';
          return `
            <li style="display:flex;justify-content:space-between;gap:1rem;border:1px solid var(--color-border);border-radius:.5rem;padding:.6rem .75rem;background:var(--color-surface-2);">
              <div>
                <strong>${name}</strong>
                <small class="muted">${u.email || ''}${role ? ` • ${role}` : ''}</small>
              </div>
              <div style="display:flex;gap:.35rem;align-items:center;">
                <select data-role-pick style="min-width:7rem;" aria-label="역할">
                  <option value="관리자">관리자</option>
                  <option value="에디터">에디터</option>
                  <option value="뷰어" selected>뷰어</option>
                </select>
                <button class=\"btn\" data-add-user data-name=\"${name}\" data-email=\"${(u.email||'').replace(/"/g,'&quot;')}\" data-role=\"뷰어\">목록에 추가</button>
              </div>
            </li>`;
        }).join('')}
      </ul>
      ${nextPageToken ? `<div style="margin-top:.5rem;"><button class="btn" id="user-search-next">더 보기</button></div>` : ''}
    `;

    // sync selected role to add button
    resultsMount.querySelectorAll('[data-role-pick]')?.forEach((sel) => {
      sel.addEventListener('change', () => {
        const wrap = sel.closest('li');
        const btn = wrap?.querySelector('[data-add-user]');
        if (btn) btn.setAttribute('data-role', sel.value);
      });
    });

    const nextBtn = document.getElementById('user-search-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', async () => {
        const more = await fetchUsers({ q, pageToken: nextPageToken, limit: 20 });
        renderResults(more.users || [], more.nextPageToken || null, q);
      }, { once: true });
    }
  }

  // Initial load (first page, no filter)
  (async () => {
    info.textContent = '불러오는 중...';
    const data = await fetchUsers({ q: '', pageToken: '', limit: 20 });
    info.textContent = data.users?.length ? `총 ${data.users.length}명 표시` : '';
    renderResults(data.users || [], data.nextPageToken || null, '');
  })();

  // Search submit
  $('#user-search-form', panel)?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = String($('#user-search-q', panel)?.value || '').trim();
    info.textContent = '검색 중...';
    const data = await fetchUsers({ q, pageToken: '', limit: 20 });
    info.textContent = data.users?.length ? `검색 결과 ${data.users.length}명` : '검색 결과가 없습니다.';
    renderResults(data.users || [], data.nextPageToken || null, q);
  });
}

// ---- Settings ----
function renderSettingsTab(panel) {
  const settings = read(KEYS.settings, {}) || {};
  panel.innerHTML = card(`
    <h3>사이트 설정</h3>
    <form id="settings-form" class="admin-form" style="display:grid;gap:.75rem;margin-top:.75rem;max-width:560px;">
      <label>사이트 제목<input name="siteTitle" value="${settings.siteTitle ?? ''}" placeholder="교무타임" /></label>
      <label>기본 테마<select name="defaultTheme">
        <option value="light" ${settings.defaultTheme==='light' ? 'selected' : ''}>라이트</option>
        <option value="dark" ${settings.defaultTheme==='dark' ? 'selected' : ''}>다크</option>
      </select></label>
      <div style="display:flex;gap:.5rem;">
        <button class="btn btn--primary" type="submit">저장</button>
        <button class="btn" type="button" id="apply-settings">적용하기</button>
      </div>
      <small style="color:var(--color-text-muted);">공개 페이지 새로고침 시 적용됩니다.</small>
    </form>
    <hr style="margin:1.25rem 0; border:0; border-top:1px solid var(--color-border);"/>
    <div style="display:grid;gap:.75rem;max-width:560px;">
      <h3>데이터 백업/복원</h3>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
        <button class="btn" id="export-data">JSON 내보내기</button>
        <label class="btn" style="position:relative; overflow:hidden;">
          JSON 가져오기
          <input id="import-file" type="file" accept="application/json" style="position:absolute;inset:0;opacity:0;cursor:pointer;"/>
        </label>
      </div>
      <small style="color:var(--color-text-muted);">공지/일정/사용자/설정 값을 JSON으로 저장하거나 불러옵니다.</small>
    </div>
    <hr style="margin:1.25rem 0; border:0; border-top:1px solid var(--color-border);"/>
    <div style="display:grid;gap:.75rem;max-width:560px;">
      <h3>관리자 비밀번호</h3>
      <p class="muted">관리자 콘솔 접속용 비밀번호를 변경합니다. 슈퍼관리자(<strong>${ADMIN_EMAIL}</strong>)만 변경할 수 있습니다.</p>
      <form id="admin-code-form" style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;">
        <input id="admin-new-code" class="btn" placeholder="새 비밀번호 (숫자/문자 조합)" />
        <button class="btn btn--primary" type="submit">비밀번호 변경</button>
      </form>
      <small class="muted">기본값은 111308 입니다.</small>
    </div>
  `);

  $('#settings-form', panel)?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const next = {
      siteTitle: String(fd.get('siteTitle')||''),
      defaultTheme: String(fd.get('defaultTheme')||'light'),
    };
    write(KEYS.settings, next);
    alert('저장되었습니다. 적용하려면 공개 페이지를 새로고침하세요.');
  });

  $('#apply-settings', panel)?.addEventListener('click', () => {
    alert('설정이 저장되었습니다. 공개 페이지(홈)를 새로고침하세요.');
  });

  // Export
  $('#export-data', panel)?.addEventListener('click', () => {
    const bundle = {
      notices: readArray(KEYS.notices),
      events: readArray(KEYS.events),
      users: readArray(KEYS.users),
      settings: read(KEYS.settings, {}),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gyomutime-data.json';
    a.click();
    setTimeout(()=> URL.revokeObjectURL(url), 1000);
  });

  // Import
  $('#import-file', panel)?.addEventListener('change', async (e) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.notices) write(KEYS.notices, Array.isArray(data.notices) ? data.notices : []);
      if (data.events) write(KEYS.events, Array.isArray(data.events) ? data.events : []);
      if (data.users) write(KEYS.users, Array.isArray(data.users) ? data.users : []);
      if (data.settings && typeof data.settings === 'object') write(KEYS.settings, data.settings);
      alert('가져오기가 완료되었습니다. 필요한 페이지를 새로고침하세요.');
    } catch (err) {
      console.error(err);
      alert('가져오기에 실패했습니다. 파일 형식을 확인하세요.');
    } finally {
      e.currentTarget.value = '';
    }
  });

  // Admin code update
  $('#admin-code-form', panel)?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = String($('#admin-new-code', panel)?.value || '').trim();
    if (!code) { alert('새 비밀번호를 입력하세요.'); return; }
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Firebase 로그인 후 다시 시도하세요. (관리자 이메일)');
      const resp = await fetch('/.netlify/functions/auth/setAdminPassword', {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ code })
      });
      if (!resp.ok) {
        const data = await resp.json().catch(()=>({}));
        throw new Error(data?.error?.message || '변경 실패');
      }
      alert('관리자 비밀번호가 변경되었습니다.');
      $('#admin-new-code', panel).value = '';
    } catch (err) {
      alert('변경 실패: ' + (err?.message || '오류'));
    }
  });
}

function renderApp(mount) {
  mount.innerHTML = renderTabs();
  const panel = $('#tab-panel', mount);
  const setTab = (name) => {
    $$("[data-tab]", mount).forEach(b => b.classList.remove('btn--primary'));
    const btn = mount.querySelector(`[data-tab="${name}"]`);
    btn?.classList.add('btn--primary');
    switch (name) {
      case 'notices': return renderNoticesTab(panel);
      case 'events': return renderEventsTab(panel);
      case 'users': return renderUsersTab(panel);
      case 'settings': return renderSettingsTab(panel);
      case 'templates': return renderTemplatesTab(panel);
      default: return renderDashboard(panel);
    }
  };
  mount.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const tab = t.getAttribute('data-tab');
    if (tab) setTab(tab);
  });
  setTab('dashboard');
}

function ensureDefaults() {
  // 초기 데이터 예시가 없으면 비워둠
  if (!localStorage.getItem(KEYS.notices)) write(KEYS.notices, []);
  if (!localStorage.getItem(KEYS.events)) write(KEYS.events, []);
  if (!localStorage.getItem(KEYS.users)) write(KEYS.users, []);
  if (!localStorage.getItem(KEYS.templates)) write(KEYS.templates, []);
}

function main() {
  ensureDefaults();
  const mount = document.getElementById('auth-wrap');
  document.getElementById('logout-btn')?.addEventListener('click', logout);
  if (!isAdminSession()) renderLogin(mount); else renderApp(mount);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main, { once: true });
} else {
  main();
}
