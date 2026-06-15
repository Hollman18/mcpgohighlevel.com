import { loadEndpointCatalog } from '../src/public-web';

describe('public endpoint catalog', () => {
  it('exposes the complete audited official endpoint inventory', () => {
    const catalog = loadEndpointCatalog();

    expect(catalog.officialCount).toBe(590);
    expect(catalog.coveredCount).toBe(590);
    expect(catalog.coveragePercent).toBe(100);
    expect(catalog.endpoints).toHaveLength(590);
    expect(catalog.apps).toContain('contacts');
    expect(catalog.endpoints.every((endpoint) => endpoint.method && endpoint.path && endpoint.app)).toBe(true);
  });
});
