import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Security Baseline: Secret Exposure Prevention', () => {
  const publicDirs = [
    path.resolve(__dirname, '../../packages/types/src'),
    path.resolve(__dirname, '../../packages/design-tokens/src'),
    path.resolve(__dirname, '../../packages/validation/src'),
    path.resolve(__dirname, '../../apps/web/src/components'),
  ];

  const forbiddenPatterns = [
    /SUPABASE_SERVICE_ROLE_KEY/i,
    /SERVER_SECRET/i,
    /password\s*=\s*['"][^'"]+['"]/i,
    /BEGIN (RSA|EC|OPENSSH) PRIVATE KEY/,
  ];

  it('ensures no privileged secret identifiers or private keys exist in public client packages', () => {
    for (const dir of publicDirs) {
      if (!fs.existsSync(dir)) continue;

      const files = fs.readdirSync(dir, { recursive: true }) as string[];
      for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isFile() && (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.json'))) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          for (const pattern of forbiddenPatterns) {
            expect(
              pattern.test(content),
              `Forbidden secret pattern ${pattern} found in client file: ${fullPath}`
            ).toBe(false);
          }
        }
      }
    }
  });

  it('ensures .env file is not committed to the repository', () => {
    const rootEnvPath = path.resolve(__dirname, '../../.env');
    expect(
      fs.existsSync(rootEnvPath),
      'Direct .env file must NOT exist in the repository root (use .env.example)'
    ).toBe(false);
  });
});
