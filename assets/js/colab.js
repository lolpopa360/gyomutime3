// Colab integration: optional Gradio embed and REST API helper
// No secrets are stored here. Configure public URLs in assets/js/colab-config.js

const CFG = {
  IFRAME_URL: (typeof window !== 'undefined' && window.COLAB_IFRAME_URL) || '',
  API_BASE: (typeof window !== 'undefined' && window.COLAB_API_BASE) || '',
  TIMEOUT: (typeof window !== 'undefined' && window.COLAB_API_TIMEOUT) || 60000,
};

function injectEmbed() {
  if (!CFG.IFRAME_URL) return false;
  try {
    const main = document.getElementById('main') || document.body;
    const section = document.createElement('section');
    section.id = 'colab-embed';
    section.className = 'section';
    section.style.marginTop = 'var(--space-6)';
    section.innerHTML = `
      <div class="container">
        <h2 style="margin-bottom: var(--space-3);">Colab 데모</h2>
        <div class="card" style="padding:0; overflow:hidden;">
          <iframe src="${CFG.IFRAME_URL}"
                  title="Colab App"
                  style="width:100%; height:640px; border:0; background:var(--color-surface-2);"></iframe>
        </div>
      </div>
    `;
    main.appendChild(section);
    return true;
  } catch (_) { /* noop */ }
  return false;
}

function withTimeout(promise, ms) {
  if (!ms) return promise;
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

async function colabFetch(endpoint, opts = {}) {
  if (!CFG.API_BASE) throw new Error('COLAB_API_BASE is not configured');
  const url = `${CFG.API_BASE}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  const headers = Object.assign({ 'accept': 'application/json' }, opts.headers || {});
  const init = Object.assign({}, opts, { headers });
  const resp = await withTimeout(fetch(url, init), CFG.TIMEOUT);
  const ct = resp.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await resp.json() : await resp.text();
  if (!resp.ok) {
    const msg = (data && (data.error?.message || data.message)) || `HTTP ${resp.status}`;
    throw new Error(msg);
  }
  return data;
}

async function postJSON(endpoint, payload) {
  return colabFetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload ?? {}),
  });
}

// Expose a small API for other modules/pages
window.colab = Object.freeze({
  configured: { iframe: !!CFG.IFRAME_URL, api: !!CFG.API_BASE },
  embedActive: false,
  injectEmbed,
  fetch: colabFetch,
  postJSON,
});

// Auto-inject the embed if configured
try {
  const ok = injectEmbed();
  if (ok && window.colab) window.colab.embedActive = true;
} catch (_) { /* ignore */ }

