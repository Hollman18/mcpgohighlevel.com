const fallbackMcpUrl = 'https://go.mcpgohighlevel.com/mcp';
let mcpUrl = fallbackMcpUrl;
let catalog = [];
let filtered = [];
let visibleCount = 60;
let currentLanguage = getInitialLanguage();
const textNodes = [];

const searchInput = document.querySelector('#endpoint-search');
const appFilter = document.querySelector('#app-filter');
const methodFilter = document.querySelector('#method-filter');
const endpointList = document.querySelector('#endpoint-list');
const loadMore = document.querySelector('#load-more');

const es = {
  'Home': 'Inicio',
  'Endpoints': 'Endpoints',
  'Copy MCP URL': 'Copiar URL del MCP',
  'Technical documentation': 'Documentación técnica',
  'Explore the full GoHighLevel surface.': 'Explora toda la superficie de GoHighLevel.',
  'Search official routes by module, method, scope, or keyword. The catalog is generated from the repository coverage audit.': 'Busca rutas oficiales por módulo, método, scope o palabra clave. El catálogo se genera desde la auditoría de cobertura del repositorio.',
  'Remote MCP': 'MCP remoto',
  'Copy': 'Copiar',
  'official endpoints': 'endpoints oficiales',
  'covered endpoints': 'endpoints cubiertos',
  'verified coverage': 'cobertura verificada',
  'API modules': 'módulos de API',
  'Architecture': 'Arquitectura',
  'One remote URL, your own credentials, and structured tools.': 'Una URL remota, credenciales propias y herramientas estructuradas.',
  'MCP connection': 'Conexión MCP',
  'The agent discovers tools and executes them through Streamable HTTP.': 'El agente descubre herramientas y las ejecuta mediante Streamable HTTP.',
  'Account authorization': 'Autorización por cuenta',
  'Each user connects their own Private Integration Token and Location ID.': 'Cada usuario conecta su propio Private Integration Token y Location ID.',
  'GoHighLevel API': 'API de GoHighLevel',
  'Requests are sent to LeadConnector with documented versions and scopes.': 'Las solicitudes se envían a LeadConnector con versiones y scopes documentados.',
  'Endpoint explorer': 'Explorador de endpoints',
  'Find a technical capability.': 'Encuentra una capacidad técnica.',
  'results': 'resultados',
  'Search': 'Buscar',
  'Module': 'Módulo',
  'Method': 'Método',
  'All modules': 'Todos los módulos',
  'All': 'Todos',
  'Loading technical catalog...': 'Cargando catálogo técnico...',
  'Show more endpoints': 'Mostrar más endpoints',
  'Ready to test?': '¿Listo para probar?',
  'Connect the endpoint to your agent.': 'Conecta el endpoint a tu agente.',
  'Compatible with Claude, Codex, OpenClaw, Hermes, and any client that implements remote MCP.': 'Compatible con Claude, Codex, OpenClaw, Hermes y cualquier cliente que implemente MCP remoto.',
  'Catalog generated from audited official coverage.': 'Catálogo generado desde la cobertura oficial auditada.',
};

document.addEventListener('DOMContentLoaded', () => {
  captureTextNodes();
  applyLanguage(currentLanguage);
  setupLanguageToggle();
});

Promise.all([
  fetch('/site-config.json').then((response) => response.json()),
  fetch('/api/endpoints').then((response) => {
    if (!response.ok) throw new Error(currentLanguage === 'es' ? 'No se pudo cargar el catálogo' : 'Unable to load the catalog');
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
    </article>`).join('') : `<div class="empty">${currentLanguage === 'es' ? 'No encontramos endpoints con esos filtros.' : 'No endpoints match those filters.'}</div>`;
  loadMore.hidden = visibleCount >= filtered.length;
}

searchInput.addEventListener('input', applyFilters);
appFilter.addEventListener('change', applyFilters);
methodFilter.addEventListener('change', applyFilters);
loadMore.addEventListener('click', () => { visibleCount += 60; renderEndpoints(); });

document.querySelectorAll('[data-copy-mcp]').forEach((button) => {
  button.dataset.defaultText = button.textContent.trim();
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(mcpUrl);
      button.textContent = currentLanguage === 'es' ? 'URL copiada' : 'URL copied';
      setTimeout(() => {
        const original = button.dataset.defaultText || 'Copy MCP URL';
        button.textContent = currentLanguage === 'es' ? (es[original] || original) : original;
      }, 1600);
    } catch {
      window.prompt(currentLanguage === 'es' ? 'Copia la URL del MCP:' : 'Copy the MCP URL:', mcpUrl);
    }
  });
});

function getInitialLanguage() {
  const requested = new URLSearchParams(window.location.search).get('lang');
  if (requested === 'es' || requested === 'en') return requested;
  return localStorage.getItem('mcp-ghl-language') === 'es' ? 'es' : 'en';
}

function captureTextNodes() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  let node = walker.nextNode();
  while (node) {
    textNodes.push({ node, original: node.textContent });
    node = walker.nextNode();
  }
}

function applyLanguage(language) {
  currentLanguage = language;
  localStorage.setItem('mcp-ghl-language', language);
  document.documentElement.lang = language;
  document.querySelectorAll('[data-language-toggle]').forEach((button) => {
    button.textContent = language === 'en' ? 'ES' : 'EN';
    button.setAttribute('aria-label', language === 'en' ? 'Switch to Spanish' : 'Cambiar a inglés');
  });
  textNodes.forEach(({ node, original }) => {
    const key = original.trim();
    const translated = language === 'es' ? es[key] : null;
    node.textContent = translated ? original.replace(key, translated) : original;
  });
  searchInput.placeholder = language === 'es' ? 'Ej. contacts, reporting, conversations...' : 'Ex. contacts, reporting, conversations...';
  if (catalog.length || filtered.length) renderEndpoints();
}

function setupLanguageToggle() {
  document.querySelectorAll('[data-language-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      applyLanguage(currentLanguage === 'en' ? 'es' : 'en');
    });
  });
}

function formatApp(value) {
  return value.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
