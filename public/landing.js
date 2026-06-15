const fallbackMcpUrl = 'https://go.mcpgohighlevel.com/mcp';
let mcpUrl = fallbackMcpUrl;

fetch('/site-config.json')
  .then((response) => response.ok ? response.json() : Promise.reject(new Error('config unavailable')))
  .then((config) => {
    mcpUrl = config.mcpUrl || fallbackMcpUrl;
    document.querySelectorAll('[data-mcp-url]').forEach((element) => { element.textContent = mcpUrl; });
    document.querySelectorAll('[data-tool-count]').forEach((element) => { element.textContent = String(config.toolCount || 867); });
  })
  .catch(() => {});

document.querySelectorAll('[data-copy-mcp]').forEach((button) => {
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(mcpUrl);
      button.textContent = 'URL copiada';
      document.querySelectorAll('[data-copy-status]').forEach((element) => { element.textContent = 'Copiado'; });
      setTimeout(() => {
        button.textContent = button.closest('.final-cta') ? 'Copiar y conectar' : 'Copiar URL del MCP';
        document.querySelectorAll('[data-copy-status]').forEach((element) => { element.textContent = ''; });
      }, 1800);
    } catch {
      window.prompt('Copia la URL del MCP:', mcpUrl);
    }
  });
});
