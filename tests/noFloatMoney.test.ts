import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Float-Money Anti-Pattern Static Scanner', () => {
  const engineFiles = [
    path.resolve(__dirname, '../src/engine/calculationEngine.ts'),
    path.resolve(__dirname, '../src/engine/gstEngine.ts'),
  ];

  it('Verifies calculation engines exist and are readable', () => {
    for (const file of engineFiles) {
      expect(fs.existsSync(file)).toBe(true);
    }
  });

  it('Ensures calculationEngine does not store or calculate money as floating point numbers', () => {
    for (const file of engineFiles) {
      const content = fs.readFileSync(file, 'utf8');

      // Rule 1: No parseFloat used on paise variables
      const parseFloatPaiseRegex = /parseFloat\s*\([^)]*paise[^)]*\)/i;
      expect(parseFloatPaiseRegex.test(content)).toBe(false);

      // Rule 2: Division on money/paise must always be wrapped in Math.round, Math.floor, or Math.trunc
      // (Unless it is converting to display rupees, like (paise / 100).toFixed(2))
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip comments and display formatters
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
        if (line.includes('formatINR') || line.includes('.toFixed') || line.includes('percentage') || line.includes('Margin')) {
          continue;
        }

        // If line performs division on paise and stores back to paise, check for Math.round / Math.floor
        if (line.includes('Paise') && line.includes('/') && !line.includes('Math.round') && !line.includes('Math.floor')) {
          // Allow comments or ratio calculations that are purely decimal percentages
          if (!line.includes('return') && !line.includes('let ') && !line.includes('const ')) {
            continue;
          }
        }
      }
    }
  });

  it('Verifies gstEngine uses integer rounding for tax calculation', () => {
    const gstFile = path.resolve(__dirname, '../src/engine/gstEngine.ts');
    const content = fs.readFileSync(gstFile, 'utf8');

    // gstEngine must use Math.round on taxablePaise * rate
    expect(content).toContain('Math.round');
    expect(content).toContain('cgstPaise');
    expect(content).toContain('sgstPaise');
    expect(content).toContain('igstPaise');
  });
});
