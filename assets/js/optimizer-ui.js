// UI wiring for timetable/sectioning optimization against Colab API
// No secrets are stored here. Uses window.colab (assets/js/colab.js)

const els = {
  req: document.getElementById('opt-requirements'),
  json: document.getElementById('opt-input-json'),
  runTimetable: document.getElementById('btn-run-timetable'),
  runSectioning: document.getElementById('btn-run-sectioning'),
  dl: document.getElementById('btn-download-result'),
  status: document.getElementById('opt-status'),
  log: document.getElementById('opt-log'),
};

function setBusy(busy) {
  [els.runTimetable, els.runSectioning].forEach(b => b && (b.disabled = !!busy));
  if (els.status) els.status.textContent = busy ? '실행 중...' : '';
}

function appendLog(line) {
  if (!els.log) return;
  const prev = els.log.textContent || '';
  els.log.textContent = prev ? prev + '\n' + line : line;
  els.log.scrollTop = els.log.scrollHeight;
}

function resetLog() {
  if (els.log) els.log.textContent = '';
  if (els.status) els.status.textContent = '';
}

function setDownload(url) {
  if (!els.dl) return;
  if (url) { els.dl.href = url; els.dl.hidden = false; }
  else { els.dl.hidden = true; els.dl.removeAttribute('href'); }
}

function getPayload() {
  const requirements = (els.req?.value || '').trim();
  let input;
  const raw = (els.json?.value || '').trim();
  if (raw) {
    try { input = JSON.parse(raw); }
    catch (e) { throw new Error('입력 데이터(JSON)가 올바르지 않습니다.'); }
  }
  return { requirements, input };
}

async function startJob(kind) {
  if (!window.colab || !window.colab.postJSON) {
    alert('Colab API 구성이 필요합니다. (COLAB_API_BASE 설정)');
    return;
  }
  resetLog(); setDownload(''); setBusy(true);
  let es;
  try {
    const payload = getPayload();
    const resp = await window.colab.postJSON('/jobs', { kind, ...payload });
    const jobId = resp.job_id || resp.id;
    const eventsUrl = resp.events_url || (window.COLAB_API_BASE ? `${window.COLAB_API_BASE}/events/${jobId}` : '');
    const statusUrl = resp.status_url || (window.COLAB_API_BASE ? `${window.COLAB_API_BASE}/status/${jobId}` : '');

    if (!jobId) throw new Error('job_id 누락');
    appendLog(`[job:${jobId}] 작업이 시작되었습니다.`);

    if (eventsUrl && 'EventSource' in window) {
      es = new EventSource(eventsUrl);
      es.addEventListener('open', () => { if (els.status) els.status.textContent = '연결됨'; });
      es.addEventListener('error', () => { if (els.status) els.status.textContent = '연결 대기/끊김'; });
      es.addEventListener('message', (ev) => {
        try {
          const data = ev.data ? JSON.parse(ev.data) : {};
          if (data.type === 'progress') {
            if (els.status) els.status.textContent = data.text || '진행 중...';
            if (data.log) appendLog(data.log);
          } else if (data.type === 'log') {
            appendLog(data.text || '');
          } else if (data.type === 'error') {
            appendLog('에러: ' + (data.message || '실패'));
          } else if (data.type === 'done') {
            if (els.status) els.status.textContent = '완료';
            if (data.download_url) setDownload(data.download_url);
            if (es) es.close();
            setBusy(false);
          }
        } catch (_) {}
      });
    } else if (statusUrl) {
      // Fallback: simple polling
      const poll = async () => {
        try {
          const r = await fetch(statusUrl, { headers: { 'accept': 'application/json' } });
          const s = await r.json();
          if (s?.log) appendLog(String(s.log));
          if (s?.status === 'done') { if (s.download_url) setDownload(s.download_url); setBusy(false); return; }
          if (s?.status === 'error') { appendLog('에러: ' + (s.message || '실패')); setBusy(false); return; }
        } catch (_) {}
        setTimeout(poll, 1500);
      };
      poll();
    } else {
      appendLog('이벤트/상태 URL이 없습니다. 서버 구성을 확인하세요.');
      setBusy(false);
    }
  } catch (err) {
    appendLog('실행 실패: ' + (err?.message || String(err)));
    setBusy(false);
    if (es) try { es.close(); } catch (_) {}
  }
}

els.runTimetable?.addEventListener('click', () => startJob('timetable'));
els.runSectioning?.addEventListener('click', () => startJob('sectioning'));
