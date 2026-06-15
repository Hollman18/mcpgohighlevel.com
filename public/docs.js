const fallbackMcpUrl = 'https://go.mcpgohighlevel.com/mcp';
let mcpUrl = fallbackMcpUrl;
let catalog = [];
let filtered = [];
let visibleCount = 60;

const searchInput = document.querySelector('#endpoint-search');
const appFilter = document.querySelector('#app-filter');
const methodFilter = document.querySelector('#method-filter');
const endpointList = document.querySelector('#endpoint-list');
const loadMore = document.querySelector('#load-more');

Promise.all([
  fetch('/site-config.json').then((response) => response.json()),
  fetch('/api/endpoints').then((response) => {
    if (!response.ok) throw new Error('No se pudo cargar el catálogo');
    return response.json();
  }),
]).then(([config, data]) => {
  mcpUrl = config.mcpUrl || fallbackMcpUrl;
  document.querySelectorAll('[data-mcp-url]').forEach((element) => { element.textContent = mcpUrl; });
  document.querySelector('[data-official-count]').textContent = String(data.officialCount);
  document.querySelector('[data-covered-count]').textContent = String(data.coveredCount);
  document.querySelector('[data-coverage]').textContent = `${data.coveragePercent} %`;
  document.querySelector('[data-app-count]').textContent = String(data.apps.length);
  data.apps.forEach((app) => appFilter.add(new Option(formatApp(app), app)));
  catalog = data.endpoints;
  applyFilters();
}).catch((error) => {
  endpointList.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
});

function applyFilters() {
  const query = searchInput.value.trim().toLowerCase();
  const app = appFilter.value;
  const method = methodFilter.value;
  filtered = catalog.filter((endpoint) => {
    const haystack = [endpoint.path, endpoint.summary, endpoint.app, endpoint.method, ...(endpoint.scopes || [])].join(' ').toLowerCase();
    return (!query || haystack.includes(query)) && (!app || endpoint.app === app) && (!method || endpoint.method === method);
  });
  visibleCount = 60;
  renderEndpoints();
}

function renderEndpoints() {
  document.querySelector('[data-result-count]').textContent = String(filtered.length);
  const visible = filtered.slice(0, visibleCount);
  endpointList.innerHTML = visible.length ? visible.map((endpoint) => `
    <article class="endpoint-card">
      <span class="method ${endpoint.method.toLowerCase()}">${escapeHtml(endpoint.method)}</span>
      <div class="endpoint-main"><code>${escapeHtml(endpoint.path)}</code><p>${escapeHtml(endpoint.summary)}</p></div>
      <div class="endpoint-meta"><span>${escapeHtml(formatApp(endpoint.app))}</span>${endpoint.versions.slice(0, 1).map((version) => `<span>v ${escapeHtml(version)}</span>`).join('')}${endpoint.scopes.slice(0, 2).map((scope) => `<span>${escapeHtml(scope)}</span>`).join('')}</div>
    </article>`).join('') : '<div class="empty">No encontramos endpoints con esos filtros.</div>';
  loadMore.hidden = visibleCount >= filtered.length;
}

searchInput.addEventListener('input', applyFilters);
appFilter.addEventListener('change', applyFilters);
methodFilter.addEventListener('change', applyFilters);
loadMore.addEventListener('click', () => { visibleCount += 60; renderEndpoints(); });

document.querySelectorAll('[data-copy-mcp]').forEach((button) => {
  button.addEventListener('click', async () => {
    const original = button.textContent;
    try {
      await navigator.clipboard.writeText(mcpUrl);
      button.textContent = 'URL copiada';
      setTimeout(() => { button.textContent = original; }, 1600);
    } catch {
      window.prompt('Copia la URL del MCP:', mcpUrl);
    }
  });
});

function formatApp(value) {
  return value.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
