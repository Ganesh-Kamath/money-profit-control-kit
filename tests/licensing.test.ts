import { describe, it, expect } from 'vitest';
import { verifyLicenseKey } from '../src/engine/licenseEngine';
import { createLicenseKey } from '../tools/generate-license';

describe('Offline Ed25519 Licensing', () => {
  it('validates authentic signed Solo and Business licenses offline', async () => {
    const soloKey = await createLicenseKey({
      plan: 'solo',
      licenseeName: 'Anil Kumar',
      licenseeEmail: 'anil@example.com',
    });

    const soloRes = await verifyLicenseKey(soloKey);
    expect(soloRes.valid).toBe(true);
    expect(soloRes.plan).toBe('solo');
    expect(soloRes.licenseeName).toBe('Anil Kumar');
    expect(soloRes.licenseeEmail).toBe('anil@example.com');
    expect(soloRes.isUpdatesExpired).toBe(false);

    const bizKey = await createLicenseKey({
      plan: 'business',
      licenseeName: 'Pooja Sweet Mart',
      licenseeEmail: 'pooja@sweets.in',
    });

    const bizRes = await verifyLicenseKey(bizKey);
    expect(bizRes.valid).toBe(true);
    expect(bizRes.plan).toBe('business');
  });

  it('rejects tampered or forged license keys', async () => {
    const key = await createLicenseKey({
      plan: 'solo',
      licenseeName: 'Anil Kumar',
      licenseeEmail: 'anil@example.com',
    });

    // Tamper payload or signature
    const tampered = key.slice(0, -5) + 'XXXXX';
    const res = await verifyLicenseKey(tampered);
    expect(res.valid).toBe(false);
    expect(res.error).toBeDefined();
  });

  it('allows perpetual use of installed app even after update validity lapses', async () => {
    // License issued 2 years ago with 12 months updates
    const oldDate = new Date('2024-01-01T00:00:00Z').toISOString();
    const expiredUpdatesKey = await createLicenseKey({
      plan: 'business',
      licenseeName: 'Ramesh Store',
      licenseeEmail: 'ramesh@shop.in',
      issuedAt: oldDate,
      monthsUpdates: 12,
    });

    const res = await verifyLicenseKey(expiredUpdatesKey);
    // CRITICAL: License is still valid! User is NEVER locked out of data or installed app
    expect(res.valid).toBe(true);
    expect(res.isUpdatesExpired).toBe(true);
  });

  it('rejects keys with wrong format or missing prefix', async () => {
    const res = await verifyLicenseKey('INVALID-KEY-12345');
    expect(res.valid).toBe(false);
    expect(res.error).toContain('Invalid license format');
  });
});
