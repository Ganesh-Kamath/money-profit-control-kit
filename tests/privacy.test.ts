import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Quality Gate 5: Privacy & Zero-Network Enforcement', () => {
  const indexHtmlPath = path.resolve(__dirname, '../dist/index.html');
  const sourceIndexHtmlPath = path.resolve(__dirname, '../index.html');

  it('verifies strict Content Security Policy (CSP) in production index.html', () => {
    const html = fs.existsSync(indexHtmlPath)
      ? fs.readFileSync(indexHtmlPath, 'utf-8')
      : fs.readFileSync(sourceIndexHtmlPath, 'utf-8');

    // CSP tag existence
    expect(html).toContain('http-equiv="Content-Security-Policy"');

    // CSP directives checks
    expect(html).toContain("connect-src 'self'");
    expect(html).toContain("frame-ancestors 'none'");
    expect(html).toContain("object-src 'none'");
    expect(html).toContain("default-src 'self'");

    // Verify zero third-party telemetry, CDNs, or tracker scripts in HTML
    expect(html).not.toContain('google-analytics.com');
    expect(html).not.toContain('googletagmanager.com');
    expect(html).not.toContain('facebook.net');
    expect(html).not.toContain('supabase.co');
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('cdn.jsdelivr.net');
    expect(html).not.toContain('unpkg.com');
  });

  it('fails if any network request is attempted to an external host', async () => {
    // Mock global fetch to simulate zero-network sandbox monitor
    const networkCalls: string[] = [];
    const originalFetch = global.fetch;

    const monitoredFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      networkCalls.push(url);

      if (url.startsWith('http://') || url.startsWith('https://')) {
        const parsed = new URL(url);
        if (parsed.origin !== 'http://localhost' && parsed.origin !== 'http://127.0.0.1' && parsed.origin !== 'http://localhost:3000') {
          throw new Error(`SECURITY VIOLATION: Blocked external outbound request to ${url}`);
        }
      }
      return new Response(JSON.stringify({ ok: true }));
    });

    global.fetch = monitoredFetch as any;

    // Test that our local licensing engine never makes external network calls
    const { verifyLicenseKey } = await import('../src/engine/licenseEngine');
    const result = await verifyLicenseKey('CK-invalid-token.signature');
    expect(result.valid).toBe(false);

    // Verify ZERO outbound requests were made
    expect(networkCalls.length).toBe(0);

    // Test that attempting an external telemetry call throws a security violation
    await expect(global.fetch('https://telemetry.evilcloud.com/track')).rejects.toThrow(
      'SECURITY VIOLATION'
    );

    global.fetch = originalFetch;
  });

  it('operates fully when navigator.onLine is false (100% offline resilience)', async () => {
    // Mock offline network environment
    const originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    expect(navigator.onLine).toBe(false);

    // Run core calculation engine offline
    const { CalculationEngine } = await import('../src/engine/calculationEngine');
    const metrics = CalculationEngine.calculateMetrics(
      [
        {
          id: 'tx-1',
          workspaceId: 'ws-test',
          type: 'income',
          amountPaise: 150000,
          occurredAt: '2026-03-01T10:00:00Z',
          status: 'active',
          createdAt: '2026-03-01T10:00:00Z',
          updatedAt: '2026-03-01T10:00:00Z',
        },
        {
          id: 'tx-2',
          workspaceId: 'ws-test',
          type: 'expense',
          amountPaise: 40000,
          occurredAt: '2026-03-02T10:00:00Z',
          status: 'active',
          createdAt: '2026-03-02T10:00:00Z',
          updatedAt: '2026-03-02T10:00:00Z',
        },
      ],
      []
    );

    expect(metrics.revenuePaise).toBe(150000);
    expect(metrics.totalExpensePaise).toBe(40000);
    expect(metrics.estimatedNetProfitPaise).toBe(110000);

    // Restore online status
    Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
  });
});
