import { describe, it, expect } from 'vitest';
import { sanitizeCSVCell } from '../src/engine/calculationEngine';
import { generateUpiQrSvg } from '../src/engine/qrCode';
import * as fs from 'fs';
import * as path from 'path';

describe('Security & Vulnerability Tests', () => {
  describe('CSV Formula Injection Prevention (OWASP)', () => {
    it('Neutralizes dangerous formula prefixes (=, +, -, @, \\t, \\r)', () => {
      expect(sanitizeCSVCell('=cmd|"/C calc"!A0')).toBe(`"'=cmd|""/C calc""!A0"`);
      expect(sanitizeCSVCell('+12345')).toBe(`"'+12345"`);
      expect(sanitizeCSVCell('-9999')).toBe(`"'-9999"`);
      expect(sanitizeCSVCell('@SUM(1,2)')).toBe(`"'@SUM(1,2)"`);
      expect(sanitizeCSVCell('\tTAB_INDENT')).toBe(`"'\tTAB_INDENT"`);
    });

    it('Escapes internal quotes safely according to RFC 4180', () => {
      expect(sanitizeCSVCell('Item "Special" 500g')).toBe(`"Item ""Special"" 500g"`);
    });

    it('Handles null, undefined and normal text', () => {
      expect(sanitizeCSVCell(null)).toBe('""');
      expect(sanitizeCSVCell(undefined)).toBe('""');
      expect(sanitizeCSVCell('Chocolate Cake')).toBe('"Chocolate Cake"');
      expect(sanitizeCSVCell(1250)).toBe('"1250"');
    });
  });

  describe('UPI QR Safe Payload Generation', () => {
    it('Generates valid offline SVG for UPI payment with strict scheme', () => {
      const svg = generateUpiQrSvg({
        vpa: 'baker@oksbi',
        payeeName: 'Priya Sharma',
        amountPaise: 45000,
        transactionRef: 'INV-2026-001',
      });

      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
      // Must not contain any external scripts or remote domain fetches
      expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(svg).not.toContain('<script');
      expect(svg).not.toContain('https://');
    });

    it('Safely encodes special characters in payee name inside UPI URI', () => {
      const svg = generateUpiQrSvg({
        vpa: 'test@upi',
        payeeName: 'Sharma & Sons <Bakery>',
        amountPaise: 10000,
        transactionRef: 'REF/123&456',
      });
      expect(svg).toContain('<svg');
      // No unescaped executable script injected
      expect(svg).not.toContain('<script>');
    });
  });

  describe('Secrets & Credential Hygiene', () => {
    it('Scans src/ directory to ensure no private keys or API tokens are hardcoded', () => {
      const srcDir = path.resolve(__dirname, '../src');

      function scanDir(dir: string): string[] {
        const results: string[] = [];
        const files = fs.readdirSync(dir, { withFileTypes: true });
        for (const f of files) {
          const fullPath = path.join(dir, f.name);
          if (f.isDirectory()) {
            results.push(...scanDir(fullPath));
          } else if (f.name.endsWith('.ts') || f.name.endsWith('.tsx') || f.name.endsWith('.json')) {
            results.push(fullPath);
          }
        }
        return results;
      }

      const allFiles = scanDir(srcDir);
      const secretPatterns = [
        /AIzaSy[A-Za-z0-9_-]{33}/, // Google API Key
        /sk_live_[A-Za-z0-9]{24}/, // Stripe Secret
        /ghp_[A-Za-z0-9]{36}/, // GitHub PAT
        /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,
      ];

      for (const file of allFiles) {
        // licensing engine contains ed25519 public key, verify it doesn't contain private keys
        const content = fs.readFileSync(file, 'utf8');
        for (const pat of secretPatterns) {
          expect(pat.test(content)).toBe(false);
        }
      }
    });
  });
});
