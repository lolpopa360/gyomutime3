// electives.js — 통합 페이지: 편성 표 생성 + 간단 입력

const state = {
  termId: '',
  subjects: [], // [{ name, applicants, cap, sections }]
  subjectHeadersStartIndex: null,
  fileMeta: null,
};

const el = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// simplified mode: no blocks

function detectSubjectsStart(headers, rows) {
  // Heuristic: first index where >80% cells are 0/1 across many rows
  const numeric01 = (v) => v === 0 || v === 1 || v === '0' || v === '1';
  let idx = 0;
  outer: for (let i = 0; i < headers.length; i++) {
    let total = 0, ones = 0, zeros = 0, ok = 0;
    for (let r = 0; r < Math.min(rows.length, 200); r++) {
      const val = rows[r][i];
      if (val === undefined || val === null || val === '') continue;
      total++;
      if (numeric01(val)) { ok++; if (String(val) === '1') ones++; else zeros++; }
    }
    if (total > 20 && ok / total > 0.8) { idx = i; break outer; }
  }
  return idx;
}

function parseNumber(v) {
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : 0;
}

async function loadScriptOnce(src, globalKey) {
  if (globalKey && window[globalKey]) return window[globalKey];
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = true; s.onload = resolve; s.onerror = () => reject(new Error('script load failed: '+src));
    document.head.appendChild(s);
  });
  return globalKey ? window[globalKey] : undefined;
}

async function parseFile(file) {
  const name = file.name.toLowerCase();
  const isCSV = name.endsWith('.csv');
  const isXLSX = name.endsWith('.xlsx') || name.endsWith('.xls');
  if (!isCSV && !isXLSX) throw new Error('CSV 또는 XLSX 파일을 올려주세요.');

  let headers = [], rows = [];

  if (isCSV) {
    await loadScriptOnce('https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js', 'Papa');
    const text = await file.text();
    const result = window.Papa.parse(text, { header: true, skipEmptyLines: true });
    headers = result.meta.fields || [];
    rows = result.data.map(obj => headers.map(h => obj[h]));
  } else {
    await loadScriptOnce('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', 'XLSX');
    const buf = await file.arrayBuffer();
    const wb = window.XLSX.read(buf, { type: 'array' });
    // pick first non-empty sheet
    let json = [];
    let chosen = null;
    for (const sn of wb.SheetNames) {
      const ws = wb.Sheets[sn];
      const arr = window.XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (arr && arr.length > 0) { json = arr; chosen = sn; break; }
    }
    if (!json.length) throw new Error('모든 시트가 비어있습니다.');
    headers = Object.keys(json[0] || {});
    rows = json.map(obj => headers.map(h => obj[h]));
  }

  // detect start: try after the '이름' column; fallback to heuristic
  const startIdx = detectStartAfterName(headers) ?? robustDetectStart(headers, rows);
  state.subjectHeadersStartIndex = startIdx;
  state.fileMeta = { headers, rows, startIdx };
  state.fileMeta.filename = file.name;

  // Build is delayed until user clicks "표 생성"
  setupSubjectStartControls(headers, startIdx);
}

function detectStartAfterName(headers) {
  const candidates = ['이름','성명','학생명','name','student name','학생 이름'];
  const idx = headers.findIndex(h => candidates.some(k => String(h).trim().toLowerCase() === k));
  if (idx >= 0) return idx + 1;
  return null;
}

function robustDetectStart(headers, rows) {
  // Scan for the first index where the next 5 columns are mostly 0/1 values across many rows.
  const is01 = (v) => v === 0 || v === 1 || v === '0' || v === '1';
  const R = Math.min(rows.length, 400);
  for (let i = 0; i < headers.length; i++) {
    let okColumns = 0;
    for (let c = i; c < Math.min(i + 6, headers.length); c++) {
      let total = 0, ok = 0;
      for (let r = 0; r < R; r++) {
        const val = rows[r][c];
        if (val === undefined || val === null || val === '') continue;
        total++;
        if (is01(val)) ok++;
      }
      if (total > 20 && ok / total > 0.8) okColumns++;
    }
    if (okColumns >= 4) return i;
  }
  return 0; // fallback
}

function buildSubjectsFrom(startIdx) {
  const { headers, rows } = state.fileMeta;
  const subjects = [];
  for (let c = startIdx; c < headers.length; c++) {
    const raw = headers[c];
    const name = String(raw ?? '').trim();
    // Skip placeholder/empty headers coming from Excel (e.g., __EMPTY, Unnamed: 3)
    if (!name || /^(__EMPTY|Unnamed)/i.test(name)) continue;
    let applicants = 0;
    for (let r = 0; r < rows.length; r++) {
      const v = rows[r][c];
      if (String(v).trim() === '1') applicants++;
    }
    subjects.push({ name, applicants, cap: 0, sections: 0 });
  }
  state.subjects = subjects;
  renderTable();
}

function setupSubjectStartControls(headers, startIdx) {
  const box = el('#subject-start');
  const sel = el('#subject-start-select');
  const hint = el('#subject-start-hint');
  sel.innerHTML = headers.map((h, i) => `<option value="${i}" ${i===startIdx?'selected':''}>${i+1}. ${h}</option>`).join('');
  hint.textContent = `자동 감지된 시작 열: ${startIdx+1}`;
  box.style.display = 'flex';
  sel.onchange = () => {
    const idx = parseInt(sel.value, 10);
    state.subjectHeadersStartIndex = idx;
    buildSubjectsFrom(idx);
  };
}

function renderTable() {
  const thead = el('#tbl-head');
  const tbody = el('#tbl-body');
  const tfoot = el('#tbl-foot');
  if (!state.subjects.length) { thead.innerHTML = ''; tbody.innerHTML = ''; tfoot.innerHTML=''; return; }

  // Header
  thead.innerHTML = `
    <tr>
      <th scope="col"><input type="checkbox" id="chk-all"/></th>
      <th scope="col">과목</th>
      <th scope="col">신청 수</th>
      <th scope="col">최대 정원</th>
      <th scope="col">분반 수</th>
    </tr>
  `;

  // Body
  tbody.innerHTML = state.subjects.map((s, rowIdx) => `
    <tr data-row="${rowIdx}">
      <td><input type="checkbox"/></td>
      <td>${s.name}</td>
      <td>${s.applicants}</td>
      <td><input class="cell-cap" type="number" min="0" value="${s.cap}" data-role="cap"/></td>
      <td><input class="cell-num" type="number" min="0" value="${s.sections}" data-role="sections"/></td>
    </tr>
  `).join('');

  // Footer: 총 수용 인원
  tfoot.innerHTML = `
    <tr>
      <td colspan="3" class="mini muted">총 수용 인원(분반 수 × 최대 정원 합)</td>
      <td colspan="2" data-foot="capacity-all">0</td>
    </tr>`;

  bindTableEvents();
  recalcTotals();
}

function bindTableEvents() {
  el('#chk-all')?.addEventListener('change', (e) => {
    $$('#tbl-body input[type="checkbox"]').forEach(c => c.checked = e.target.checked);
  });

  el('#tbl-body').addEventListener('input', (e) => {
    const target = e.target;
    const tr = target.closest('tr');
    const rowIdx = parseInt(tr.dataset.row, 10);
    const s = state.subjects[rowIdx];
    const role = target.getAttribute('data-role');
    if (role === 'sections') s.sections = parseNumber(target.value);
    else if (role === 'cap') s.cap = parseNumber(target.value);
    recalcTotals();
  });
}

function recalcTotals() {
  let capacityAll = 0;
  for (const s of state.subjects) capacityAll += (s.sections || 0) * (s.cap || 0);
  const all = el('[data-foot="capacity-all"]');
  if (all) all.textContent = String(capacityAll);
}

function exportCSV() {
  if (!state.subjects.length) return alert('표 데이터가 없습니다.');
  const head = ['name','applicants','cap','sections'];
  const rows = state.subjects.map(s => [ s.name, s.applicants, s.cap || 0, s.sections || 0 ]);
  const csv = [head.join(','), ...rows.map(r => r.map(v => (typeof v === 'string' && v.includes(',')) ? `"${v.replace(/"/g,'""')}"` : String(v)).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `electives_${Date.now()}.csv`;
  a.click();
}

async function saveToFirestore() {
  const termId = (el('#term-id').value || '').trim();
  if (!termId) return alert('학기/버전을 입력해주세요.');
  if (!state.subjects.length) return alert('먼저 파일을 불러오고 표를 생성해주세요.');
  const payload = { termId, subjects: state.subjects, meta: { sourceFile: { startIdx: state.subjectHeadersStartIndex } } };
  try {
    const res = await fetch('/.netlify/functions/electives-save', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || 'save failed');
    alert('저장 완료: ' + data.id);
  } catch (e) {
    console.error(e);
    alert('저장 중 오류가 발생했습니다.');
  }
}

// Wiring
window.addEventListener('DOMContentLoaded', () => {
  el('#year').textContent = new Date().getFullYear();

  el('#file-input').addEventListener('change', async (ev) => {
    const f = ev.target.files?.[0];
    if (!f) return;
    el('#file-label').textContent = f.name;
    // Reset table subjects before parsing
    state.subjects = [];
    try {
      await parseFile(f);
      // Wait for user to click "표 생성"
    } catch (e) {
      console.error(e);
      alert('파일을 해석할 수 없습니다. CSV 또는 XLSX 형식인지 확인해주세요.');
    }
  });

  el('#generate-btn').addEventListener('click', () => {
    if (!state.fileMeta) { alert('먼저 파일을 불러오세요.'); return; }
    buildSubjectsFrom(state.subjectHeadersStartIndex ?? 0);
  });

  el('#export-btn').addEventListener('click', exportCSV);
  // 저장 버튼은 현재 UI에서 제거했지만 기능은 유지할 수 있음. 필요 시 아래 줄을 사용하세요.
  // el('#save-btn').addEventListener('click', saveToFirestore);

  // 분반 배정 제출(파일 재업로드 없이 표 데이터 전송)
  el('#gr-submit')?.addEventListener('click', submitRequest);
});

function setStatus(msg, ok = true) {
  const s = el('#gr-status'); if (!s) return;
  s.textContent = msg || '';
  s.style.color = ok ? 'var(--color-text-muted)' : '#ef4444';
}

async function submitRequest() {
  try {
    const name = (el('#gr-name')?.value || '').trim();
    const email = (el('#gr-email')?.value || '').trim();
    const notes = (el('#gr-notes')?.value || '').trim();
    const minSlots = parseNumber(el('#gr-min-slots')?.value || '1');
    const maxSlots = parseNumber(el('#gr-max-slots')?.value || '3');
    const termId = (el('#term-id')?.value || '').trim();
    if (!state.subjects.length) { alert('먼저 파일을 불러오고 표를 생성하세요.'); return; }
    if (!name || !email) { alert('담당자 이름/이메일을 입력하세요.'); return; }

    setStatus('제출 중...');
    const payload = {
      termId,
      contact: { name, email },
      constraints: { minSlots, maxSlots },
      notes,
      source: { filename: state.fileMeta?.filename || null, startIdx: state.subjectHeadersStartIndex },
      table: { subjects: state.subjects }
    };
    const res = await fetch('/.netlify/functions/electives-submit', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || 'submit failed');
    setStatus('제출 완료: ' + data.id);
    alert('배정 요청이 접수되었습니다.');
  } catch (e) {
    console.error(e);
    setStatus('제출 실패', false);
    alert('제출 중 오류가 발생했습니다.');
  }
}
// 끝
