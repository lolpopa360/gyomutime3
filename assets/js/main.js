import { logger, initLoggerFromEnv } from './utils/logger.js';

// Small DOM helpers
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// Safe handler wrapper
const safe = (fn) => (ev) => {
  try { return fn(ev); } catch (err) { logger.error('Unhandled error', err); }
};

function setYear() {
  const el = $('#year');
  if (el) el.textContent = String(new Date().getFullYear());
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.setAttribute('data-theme', 'dark');
  } else {
    root.removeAttribute('data-theme');
  }
}

function inferInitialTheme() {
  const stored = localStorage.getItem('theme');
  if (stored === 'dark' || stored === 'light') return stored;
  // 기본값을 다크로 설정해 디자인 가이드를 반영
  return 'dark';
}

function setupThemeToggle() {
  let theme = inferInitialTheme();
  applyTheme(theme);
  logger.debug('Initial theme', theme);

  document.addEventListener('click', safe((e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const btn = t.closest('[data-action="toggle-theme"]');
    if (!btn) return;
    theme = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', theme);
    applyTheme(theme);
    logger.info('Theme toggled', theme);
  }));
}

function applySettings() {
  try {
    const raw = localStorage.getItem('app.settings');
    if (!raw) return;
    const settings = JSON.parse(raw) || {};
    // 사이트 제목
    if (settings.siteTitle) {
      const brand = document.querySelector('.brand span');
      if (brand) brand.textContent = settings.siteTitle;
      if (document.title) {
        const parts = document.title.split('•');
        document.title = `${settings.siteTitle.trim()} • ${parts.length > 1 ? parts[1].trim() : '사이트'}`;
      }
    }
    // 기본 테마: 사용자가 직접 설정하지 않았을 때만 반영
    if (!localStorage.getItem('theme') && (settings.defaultTheme === 'dark' || settings.defaultTheme === 'light')) {
      localStorage.setItem('theme', settings.defaultTheme);
      applyTheme(settings.defaultTheme);
    }
  } catch (_) { /* ignore */ }
}

function setupNavToggle() {
  const toggle = $('[data-toggle="nav"]');
  const nav = $('#site-nav');
  if (!toggle || !nav) return;

  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    nav.dataset.open = String(open);
  };

  setOpen(false);

  toggle.addEventListener('click', safe(() => {
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    setOpen(!isOpen);
  }));

  // Close nav on wide screens
  const mq = window.matchMedia('(min-width: 760px)');
  const handleMQ = () => { if (mq.matches) setOpen(false); };
  mq.addEventListener ? mq.addEventListener('change', handleMQ) : mq.addListener(handleMQ);
}

function setupCounter() {
  document.addEventListener('click', safe((e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const btn = t.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action !== 'increment' && action !== 'decrement') return;
    const wrap = btn.closest('.counter');
    const out = wrap && $('.counter__value', wrap);
    if (!out) return;
    const current = parseInt(out.textContent || '0', 10) || 0;
    const next = action === 'increment' ? current + 1 : current - 1;
    out.textContent = String(next);
    logger.debug('Counter', { action, current, next });
  }));
}

// ---- Data & Rendering (Public) ----
const STORAGE_KEYS = {
  notices: 'app.announcements',
  events: 'app.events',
};

function loadArray(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (_) {
    return [];
  }
}

function fmtDate(dateStr) {
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(+d)) return dateStr;
    return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(d);
  } catch (_) {
    return dateStr;
  }
}

function renderNotices() {
  const mount = document.getElementById('notice-list');
  if (!mount) return;
  const notices = loadArray(STORAGE_KEYS.notices)
    .slice()
    .sort((a,b) => (b?.pinned === true) - (a?.pinned === true) || (new Date(b?.date||0) - new Date(a?.date||0)));

  if (!notices.length) {
    mount.innerHTML = '<div class="card"><p>등록된 공지사항이 없습니다.</p></div>';
    return;
  }

  mount.innerHTML = notices.map(n => `
    <article class="card" aria-label="공지">
      <header style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;margin-bottom:.5rem;">
        <h3 style="font-size:var(--fs-500);">${n.title ?? ''}</h3>
        ${n.pinned ? '<span class="badge" aria-label="상단 고정">📌</span>' : ''}
      </header>
      ${n.date ? `<small style="color:var(--color-text-muted);">${fmtDate(n.date)}</small>` : ''}
      ${n.content ? `<p style="margin-top:.5rem;color:var(--color-text);">${n.content}</p>` : ''}
    </article>
  `).join('');
}

function renderEvents() {
  const mount = document.getElementById('event-list');
  if (!mount) return;
  const events = loadArray(STORAGE_KEYS.events)
    .slice()
    .sort((a,b) => new Date(a?.date||0) - new Date(b?.date||0));

  if (!events.length) {
    mount.innerHTML = '<div class="card"><p>등록된 일정이 없습니다.</p></div>';
    return;
  }

  mount.innerHTML = `
    <div class="card">
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:var(--space-3);">
        ${events.map(e => `
          <li style="display:flex;gap:1rem;align-items:flex-start;border-bottom:1px dashed var(--color-border);padding-bottom:.6rem;">
            <div style="min-width:8rem;color:var(--color-text-muted);">${e.date ? fmtDate(e.date) : ''}</div>
            <div>
              <div style="font-weight:600;">${e.title ?? ''}</div>
              ${e.description ? `<div style="color:var(--color-text-muted);margin-top:.25rem;">${e.description}</div>` : ''}
            </div>
          </li>
        `).join('')}
      </ul>
    </div>`;
}

// ---- Local Demo: submission flow (no network) ----
function setupLocalDemo() {
  const dz = document.getElementById('demo-drop');
  const fi = document.getElementById('demo-file-input');
  const list = document.getElementById('demo-files');
  const btn = document.getElementById('demo-submit');
  const title = document.getElementById('demo-title');
  const category = document.getElementById('demo-category');
  const board = document.getElementById('demo-list');
  if (!dz || !fi || !list || !btn || !title || !category || !board) return;

  let files = [];

  const ACCEPT = new Set([
    'application/pdf','application/zip','application/x-zip-compressed',
    'text/csv','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/json','image/png','image/jpeg','image/webp'
  ]);

  const updateList = () => {
    if (!files.length) { list.textContent = '선택된 파일이 없습니다.'; return; }
    list.innerHTML = '<ul style="list-style:none;padding:0;display:grid;gap:.3rem;">' + files.map(f => `<li>${f.name} <small class="muted">(${(f.size/1024/1024).toFixed(2)} MB)</small></li>`).join('') + '</ul>';
  };

  const addFiles = (incoming) => {
    const arr = Array.from(incoming || []).filter(f => ACCEPT.has(f.type) || f.size > 0);
    files = files.concat(arr).slice(0, 8); // cap
    updateList();
  };

  dz.addEventListener('click', () => fi.click());
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('dragover'); addFiles(e.dataTransfer && e.dataTransfer.files); });
  fi.addEventListener('change', () => addFiles(fi.files));

  function readDemo() {
    try { return JSON.parse(localStorage.getItem('demo.submissions') || '[]'); } catch { return []; }
  }
  function writeDemo(arr) { localStorage.setItem('demo.submissions', JSON.stringify(arr)); }

  function simulateProcessing(id) {
    setTimeout(() => {
      const arr = readDemo();
      const it = arr.find(x => x.id === id);
      if (!it) return;
      it.status = 'processing'; it.updatedAt = new Date().toISOString();
      writeDemo(arr); renderBoard();
      setTimeout(() => {
        const arr2 = readDemo();
        const it2 = arr2.find(x => x.id === id);
        if (!it2) return;
        it2.status = 'completed'; it2.updatedAt = new Date().toISOString();
        it2.results = [{ name: 'result.txt', size: 19, storagePath: 'local/demo/result.txt', contentType: 'text/plain' }];
        writeDemo(arr2); renderBoard();
      }, 2200);
    }, 900);
  }

  function downloadSample() {
    const blob = new Blob(['샘플 결과 (데모)'], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'result.txt'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function renderBoard() {
    const arr = readDemo().slice().sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
    if (!arr.length) { board.textContent = '아직 제출이 없습니다.'; return; }
    board.innerHTML = arr.map(it => `
      <article class="card" style="margin-bottom: .75rem;">
        <header style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;">
          <div>
            <strong>${it.title}</strong>
            <div class="muted" style="font-size:.9em;">${new Date(it.createdAt).toLocaleString('ko-KR')} • ${it.category}</div>
          </div>
          <span class="badge">${it.status}</span>
        </header>
        ${it.files && it.files.length ? `<ul style="list-style:none;padding:0;margin-top:.5rem;display:grid;gap:.25rem;">${it.files.map(f=>`<li>${f.name} <small class=\"muted\">(${(f.size/1024/1024).toFixed(2)} MB)</small></li>`).join('')}</ul>`: ''}
        ${it.status==='completed' ? `<div style="margin-top:.5rem;"><button class="btn" data-demo-download>결과 다운로드</button></div>` : ''}
      </article>
    `).join('');
    // attach download buttons
    board.querySelectorAll('[data-demo-download]')?.forEach(btn => {
      btn.addEventListener('click', downloadSample, { once: false });
    });
  }

  btn.addEventListener('click', () => {
    const t = (title && title.value || '').trim();
    if (!t) { alert('제목을 입력하세요.'); return; }
    if (!files.length) { alert('파일을 선택하세요.'); return; }
    const entry = {
      id: String(Date.now()),
      title: t.slice(0, 100),
      description: '',
      category: category && category.value || '기타',
      status: 'uploaded',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      files: files.map(f => ({ name: f.name, size: f.size, contentType: f.type }))
    };
    const arr = readDemo(); arr.unshift(entry); writeDemo(arr);
    files = []; updateList(); renderBoard(); simulateProcessing(entry.id);
  });

  // init
  updateList(); renderBoard();
}

function exposeDebugControls() {
  window.appDebug = {
    enable() { localStorage.setItem('debug','1'); logger.setEnabled(true); logger.info('Debug enabled'); },
    disable() { localStorage.removeItem('debug'); logger.setEnabled(false); console.info('[INFO] Debug disabled'); },
    logger,
  };
}

// ---- Floating Chat Widget ----
function setupChatWidget() {
  // Create FAB and panel
  if (document.querySelector('.chat-fab')) return; // once
  const fab = document.createElement('button');
  fab.className = 'chat-fab';
  fab.setAttribute('aria-label', '도움말 열기');
  fab.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4"/></svg>';

  const panel = document.createElement('div');
  panel.className = 'chat-panel';
  panel.innerHTML = `
    <div class="chat-panel__header">
      <strong>도움말 챗봇</strong>
      <button class="btn" data-close-chat aria-label="닫기">✕</button>
    </div>
    <div class="chat-panel__log" id="chat-log"></div>
    <form class="chat-panel__form" id="chat-form">
      <input class="chat-panel__input" id="chat-input" placeholder="사이트 사용 관련 질문을 입력하세요" />
      <button class="btn btn--primary" type="submit">보내기</button>
    </form>
  `;

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  const log = panel.querySelector('#chat-log');
  const form = panel.querySelector('#chat-form');
  const input = panel.querySelector('#chat-input');
  const add = (by, text) => {
    const item = document.createElement('div');
    item.style.margin = '.25rem 0';
    item.innerHTML = `<div style="display:flex; gap:.5rem; align-items:flex-start;">${by==='bot'?'<span>🤖</span>':'<span>🙂</span>'}<div style="white-space:pre-wrap;">${text}</div></div>`;
    log.appendChild(item); log.scrollTop = log.scrollHeight;
  };
  const greetOnceKey = 'chat.greeted';
  const open = (show=true) => { panel.dataset.open = String(show); if (show && !localStorage.getItem(greetOnceKey)) { add('bot', '안녕하세요! 교무타임 고객지원 챗봇입니다. 웹사이트 사용 관련 질문에만 답합니다.'); localStorage.setItem(greetOnceKey, '1'); } };

  fab.addEventListener('click', () => open(panel.dataset.open !== 'true'));
  panel.querySelector('[data-close-chat]')?.addEventListener('click', (e) => { e.preventDefault(); open(false); });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = (input.value || '').trim(); if (!q) return;
    add('me', q);
    // Simple rule-based helper limited to site usage
    const siteKeywords = ['로그인','회원가입','관리자','시간표','분반','파일','업로드','다운로드','데이터','양식','문의','에러','오류','설정','테마','콘솔','권한'];
    const containsSite = siteKeywords.some(k => q.includes(k));
    if (!containsSite) {
      add('bot', '본 챗봇은 웹사이트 사용 관련 질문만 도와드립니다. 사이트 이용에 관한 질문을 해주세요.');
    } else {
      if (q.includes('로그인')) add('bot', '상단 “로그인”을 눌러 로그인/회원가입/관리자 인증을 선택할 수 있습니다.');
      else if (q.includes('회원') || q.includes('가입')) add('bot', '로그인 버튼을 눌러 “회원가입”을 선택해 이메일/비밀번호 또는 Google로 가입하세요.');
      else if (q.includes('관리자')) add('bot', '관리자 인증은 로그인 → “관리자 인증”에서 진행합니다. 승인이 필요한 경우 슈퍼관리자에게 요청하세요.');
      else if (q.includes('데이터') && q.includes('양식')) add('bot', '데이터 양식은 홈 하단 “데이터 양식 다운로드”에서 내려받고, 관리자는 콘솔의 “데이터 양식” 탭에서 수정할 수 있습니다.');
      else if (q.includes('테마')) add('bot', '상단 내비게이션의 “테마 전환”으로 라이트/다크를 변경할 수 있습니다.');
      else add('bot', '문의 주신 내용은 확인 후 도와드리겠습니다. 페이지/동작을 구체적으로 알려주시면 빠르게 해결됩니다.');
    }
    input.value = '';
  });
}

function main() {
  const debugEnabled = initLoggerFromEnv();
  logger.info('App init', { debugEnabled });

  setYear();
  applySettings();
  setupThemeToggle();
  setupNavToggle();
  setupCounter();
  setupLocalDemo();
  renderNotices();
  renderEvents();
  setupChatWidget();
  exposeDebugControls();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main, { once: true });
} else {
  main();
}
