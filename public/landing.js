const fallbackMcpUrl = 'https://go.mcpgohighlevel.com/mcp';
let mcpUrl = fallbackMcpUrl;

const textNodes = [];
let currentLanguage = getInitialLanguage();

const es = {
  'Value': 'Valor',
  'Agents': 'Agentes',
  'Reports': 'Reportes',
  'Docs': 'Docs',
  'Connect': 'Conectar',
  'Live service · Free': 'Servicio activo · Gratis',
  'GoHighLevel for any AI agent.': 'GoHighLevel para cualquier agente de IA.',
  'Connect your CRM once and use it from Claude, Codex, OpenClaw, Hermes, or any MCP client. Query data, run actions, and create reports without local infrastructure.': 'Conecta tu CRM una sola vez y úsalo desde Claude, Codex, OpenClaw, Hermes o cualquier cliente MCP. Consulta datos, ejecuta acciones y crea reportes sin infraestructura local.',
  'Copy MCP URL': 'Copiar URL del MCP',
  'Explore docs': 'Explorar docs',
  'Endpoint': 'Endpoint',
  'No local install': 'Sin instalación local',
  'Account-isolated credentials': 'Credenciales aisladas por cuenta',
  'Compatible with the MCP standard': 'Compatible con el estándar MCP',
  'Claude': 'Claude',
  'Codex': 'Codex',
  'OpenClaw': 'OpenClaw',
  'Hermes': 'Hermes',
  'Any MCP agent': 'Cualquier agente MCP',
  'OPEN PROTOCOL': 'PROTOCOLO ABIERTO',
  'MCP': 'MCP',
  'One secure URL': 'Una URL segura',
  'YOUR CRM': 'TU CRM',
  'GoHighLevel': 'GoHighLevel',
  'available tools': 'herramientas disponibles',
  'official endpoints covered': 'endpoints oficiales cubiertos',
  'analytics tools': 'herramientas de analítica',
  'currently free': 'gratis actualmente',
  'Why it exists': 'Por qué existe',
  'Your CRM stops being an island.': 'Tu CRM deja de ser una isla.',
  'We turn the HighLevel API into a practical layer for people, teams, and AI agents. Less manual work, more context, and faster decisions.': 'Convertimos la API de HighLevel en una capa práctica para personas, equipos y agentes de IA. Menos trabajo manual, más contexto y decisiones más rápidas.',
  'For people': 'Para personas',
  'Ask, analyze, and act without opening twenty screens.': 'Pregunta, analiza y actúa sin abrir veinte pantallas.',
  'Query contacts, conversations, appointments, opportunities, and activity using natural language.': 'Consulta contactos, conversaciones, citas, oportunidades y actividad usando lenguaje natural.',
  'Fewer repetitive tasks': 'Menos tareas repetitivas',
  'Answers with CRM context': 'Respuestas con contexto del CRM',
  'Freedom to choose your agent': 'Libertad para elegir tu agente',
  'For businesses': 'Para negocios',
  'Turn team activity into manageable intelligence.': 'Convierte la actividad del equipo en inteligencia accionable.',
  'Compare sellers, find pending follow-ups, and understand what is happening across your pipeline.': 'Compara vendedores, encuentra seguimientos pendientes y entiende qué ocurre en tu pipeline.',
  'Reports by user and team': 'Reportes por usuario y equipo',
  'Sales production visibility': 'Visibilidad de producción comercial',
  'Automation on real data': 'Automatización sobre datos reales',
  'For developers': 'Para desarrolladores',
  'A remote integration with verifiable coverage.': 'Una integración remota con cobertura verificable.',
  'Explore routes, methods, scopes, and modules from a technical catalog that stays aligned with the repository.': 'Explora rutas, métodos, scopes y módulos desde un catálogo técnico alineado con el repositorio.',
  '590 official endpoints covered': '590 endpoints oficiales cubiertos',
  '867 MCP tools': '867 herramientas MCP',
  'CI/CD and remote endpoint': 'CI/CD y endpoint remoto',
  'Open technical docs →': 'Abrir docs técnicas →',
  'Agent-neutral': 'Neutral para agentes',
  'You are not locked into one AI platform.': 'No quedas amarrado a una sola plataforma de IA.',
  'The server speaks MCP. If an agent or client supports the protocol, it can connect to the same endpoint and work with your authorized account.': 'El servidor habla MCP. Si un agente o cliente soporta el protocolo, puede conectarse al mismo endpoint y trabajar con tu cuenta autorizada.',
  'Connectors and MCP clients': 'Connectors y clientes MCP',
  'Tools and automation': 'Herramientas y automatización',
  'Agents and autonomous workflows': 'Agentes y flujos autónomos',
  'MCP-compatible clients': 'Clientes compatibles con MCP',
  'Your next agent': 'Tu próximo agente',
  'Compatible if it implements MCP': 'Compatible si implementa MCP',
  'Compatibility depends on the client implementing remote MCP transport and authentication. The server does not contain Claude-only logic.': 'La compatibilidad depende de que el cliente implemente transporte MCP remoto y autenticación. El servidor no tiene lógica exclusiva para Claude.',
  'Your CRM, available': 'Tu CRM, disponible',
  'From scattered data to clear answers.': 'De datos dispersos a respuestas claras.',
  'Tools designed for real business questions, plus direct API coverage.': 'Herramientas diseñadas para preguntas reales de negocio, además de cobertura directa de API.',
  'Commercial activity': 'Actividad comercial',
  'Calls, SMS, WhatsApp, and email by user, contact, date, or team.': 'Llamadas, SMS, WhatsApp y email por usuario, contacto, fecha o equipo.',
  'Sales and pipeline': 'Ventas y pipeline',
  'Opportunities, stages, value, conversion, won, lost, and forecast.': 'Oportunidades, etapas, valor, conversión, ganadas, perdidas y forecast.',
  'Contacts and follow-up': 'Contactos y seguimiento',
  'Assignments, conversations, tasks, appointments, notes, and next steps.': 'Asignaciones, conversaciones, tareas, citas, notas y próximos pasos.',
  'Large history windows': 'Históricos amplios',
  'Pagination and range scans to move beyond the first page of results.': 'Paginación y barridos por rango para ir más allá de la primera página de resultados.',
  'Calls': 'Llamadas',
  'SMS': 'SMS',
  'WhatsApp': 'WhatsApp',
  'Email': 'Email',
  'Contacts': 'Contactos',
  'Pipeline': 'Pipeline',
  'Calendars': 'Calendarios',
  'Payments': 'Pagos',
  'Business intelligence': 'Inteligencia de negocio',
  'Reports designed to manage teams.': 'Reportes diseñados para gestionar equipos.',
  'Compare production, activity, and outcomes without knowing GoHighLevel endpoints.': 'Compara producción, actividad y resultados sin conocer endpoints de GoHighLevel.',
  'Subscription software': 'Software por suscripción',
  'SaaS Sales Intelligence': 'Inteligencia comercial SaaS',
  'Setter and closer production': 'Producción de setters y closers',
  'Open, won, and lost pipeline': 'Pipeline abierto, ganado y perdido',
  'Effective calls and messages': 'Llamadas y mensajes efectivos',
  'Follow-up, risk, and forecast': 'Seguimiento, riesgo y forecast',
  'Info products': 'Infoproductos',
  'Value Ladder Intelligence': 'Inteligencia Value Ladder',
  'Lead magnet and entry offer': 'Lead magnet y oferta de entrada',
  'Masterclass, webinar, and workshop': 'Masterclass, webinar y workshop',
  'Applications and high ticket': 'Aplicaciones y high ticket',
  'Conversion by offer and seller': 'Conversión por oferta y vendedor',
  'Technical hub': 'Centro técnico',
  'Search exactly what you can do.': 'Busca exactamente qué puedes hacer.',
  'Browse 590 official endpoints by module, method, or keyword. Review routes, scopes, and versions before integrating.': 'Explora 590 endpoints oficiales por módulo, método o palabra clave. Revisa rutas, scopes y versiones antes de integrar.',
  'Open endpoint explorer': 'Abrir explorador de endpoints',
  'Guided setup': 'Instalación guiada',
  'Connect your account in three steps.': 'Conecta tu cuenta en tres pasos.',
  'Add the endpoint': 'Agrega el endpoint',
  'Paste the remote URL into your MCP client.': 'Pega la URL remota en tu cliente MCP.',
  'Authorize HighLevel': 'Autoriza HighLevel',
  'Use your Private Integration Token and Location ID.': 'Usa tu Private Integration Token y Location ID.',
  'Ask your first question': 'Haz tu primera pregunta',
  'Request CRM actions or business reports in natural language.': 'Pide acciones del CRM o reportes de negocio en lenguaje natural.',
  'Your credentials are encrypted and belong only to your connection.': 'Tus credenciales se cifran y pertenecen solo a tu conexión.',
  'Animated guide to find the Location ID and Private Integration Token in HighLevel': 'Guía animada para encontrar el Location ID y Private Integration Token en HighLevel',
  'How to find the Location ID and Private Integration Token in HighLevel.': 'Cómo encontrar el Location ID y el Private Integration Token en HighLevel.',
  'You choose the agent': 'Tú eliges el agente',
  'One connection. Your whole CRM.': 'Una conexión. Todo tu CRM.',
  'Start free with any MCP-compatible client.': 'Empieza gratis con cualquier cliente compatible con MCP.',
  'Copy and connect': 'Copiar y conectar',
  'View Docs': 'Ver docs',
  'Independent community project. Not affiliated with or endorsed by HighLevel.': 'Proyecto comunitario independiente. No afiliado ni respaldado por HighLevel.',
};

document.addEventListener('DOMContentLoaded', () => {
  captureTextNodes();
  applyLanguage(currentLanguage);
  setupLanguageToggle();
  setupCopyButtons();
});

fetch('/site-config.json')
  .then((response) => response.ok ? response.json() : Promise.reject(new Error('config unavailable')))
  .then((config) => {
    mcpUrl = config.mcpUrl || fallbackMcpUrl;
    document.querySelectorAll('[data-mcp-url]').forEach((element) => { element.textContent = mcpUrl; });
    document.querySelectorAll('[data-tool-count]').forEach((element) => { element.textContent = String(config.toolCount || 867); });
  })
  .catch(() => {});

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
}

function setupLanguageToggle() {
  document.querySelectorAll('[data-language-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      applyLanguage(currentLanguage === 'en' ? 'es' : 'en');
    });
  });
}

function setupCopyButtons() {
  document.querySelectorAll('[data-copy-mcp]').forEach((button) => {
    button.dataset.defaultText = button.textContent.trim();
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(mcpUrl);
        button.textContent = currentLanguage === 'es' ? 'URL copiada' : 'URL copied';
        document.querySelectorAll('[data-copy-status]').forEach((element) => {
          element.textContent = currentLanguage === 'es' ? 'Copiado' : 'Copied';
        });
        setTimeout(() => {
          const original = button.dataset.defaultText || 'Copy MCP URL';
          button.textContent = currentLanguage === 'es' ? (es[original] || original) : original;
          document.querySelectorAll('[data-copy-status]').forEach((element) => { element.textContent = ''; });
        }, 1800);
      } catch {
        window.prompt(currentLanguage === 'es' ? 'Copia la URL del MCP:' : 'Copy the MCP URL:', mcpUrl);
      }
    });
  });

  document.querySelectorAll('[data-copy-prompt]').forEach((button) => {
    button.addEventListener('click', async () => {
      const prompt = button.dataset.copyPrompt;
      const label = button.querySelector('b');
      const original = label.textContent;
      try {
        await navigator.clipboard.writeText(prompt);
        label.textContent = currentLanguage === 'es' ? 'Copiado' : 'Copied';
        setTimeout(() => { label.textContent = original; }, 1600);
      } catch {
        window.prompt(currentLanguage === 'es' ? 'Copia este prompt:' : 'Copy this prompt:', prompt);
      }
    });
  });
}
