import { buildHealthPayload, sendHealthResponse } from '../src/health-response';

describe('health response', () => {
  it('keeps JSON responses for non-browser clients', () => {
    const payload = buildHealthPayload({ toolCount: 867, startTime: Date.now() - 5000 });
    const req = { get: jest.fn().mockReturnValue('*/*') };
    const res = {
      setHeader: jest.fn(),
      json: jest.fn(),
      type: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    sendHealthResponse(req as any, res as any, payload);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'healthy',
      server: 'ghl-mcp-server',
      tools: 867,
    }));
    expect(res.send).not.toHaveBeenCalled();
  });

  it('renders a clear status page for browsers', () => {
    const payload = buildHealthPayload({ toolCount: 867, startTime: Date.now() - 65000 });
    const req = { get: jest.fn().mockReturnValue('text/html,application/xhtml+xml') };
    const res = {
      setHeader: jest.fn(),
      json: jest.fn(),
      type: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    sendHealthResponse(req as any, res as any, payload);

    expect(res.type).toHaveBeenCalledWith('html');
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Service Status'));
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Operational'));
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Everything is working normally.'));
  });
});
