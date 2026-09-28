import { describe, it, expect } from 'vitest';
import { TenantId } from '@fieldops/types';

describe('Security Suite: Storage & File Upload Security', () => {
  const tenantA = '00000000-0000-0000-0000-000000000001' as TenantId;
  const tenantB = '00000000-0000-0000-0000-000000000002' as TenantId;

  const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
  const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'image/svg+xml',
  ]);
  const FORBIDDEN_EXTENSIONS = new Set([
    '.exe',
    '.sh',
    '.bat',
    '.php',
    '.js',
    '.mjs',
    '.py',
    '.rb',
    '.dll',
    '.jsp',
  ]);

  const validateFileUpload = (
    tenantId: TenantId,
    targetPath: string,
    fileName: string,
    mimeType: string,
    fileSizeBytes: number
  ): { valid: boolean; error?: string } => {
    // 1. Path Traversal & Null Byte Injection Check
    if (
      fileName.includes('..') ||
      targetPath.includes('..') ||
      fileName.includes('/') ||
      fileName.includes('\\') ||
      fileName.includes('\0')
    ) {
      return { valid: false, error: 'PATH_TRAVERSAL_DETECTED: Illegal relative path characters.' };
    }

    // 2. Tenant Path Boundary Check
    const pathSegments = targetPath.split('/');
    if (pathSegments[0] !== tenantId) {
      return { valid: false, error: 'CROSS_TENANT_STORAGE_VIOLATION: Target path does not match active tenant.' };
    }

    // 3. Size Limit Check
    if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
      return { valid: false, error: `FILE_TOO_LARGE: Exceeds max allowed size of ${MAX_FILE_SIZE_BYTES} bytes.` };
    }

    // 4. MIME Type Validation
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return { valid: false, error: `ILLEGAL_MIME_TYPE: MIME type ${mimeType} is not permitted.` };
    }

    // 5. Dangerous Extension Validation
    const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
    if (FORBIDDEN_EXTENSIONS.has(ext)) {
      return { valid: false, error: `DANGEROUS_FILE_EXTENSION: Extension ${ext} is strictly prohibited.` };
    }

    return { valid: true };
  };

  it('rejects path traversal attempts in file names and target paths', () => {
    const maliciousNames = [
      '../../../etc/passwd',
      '..\\..\\windows\\system.ini',
      'folder/../../proof.jpg',
      'image.png\0.exe',
    ];

    for (const name of maliciousNames) {
      const res = validateFileUpload(tenantA, `${tenantA}/proofs`, name, 'image/jpeg', 1024);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('PATH_TRAVERSAL');
    }
  });

  it('prevents uploading files into another organization storage path', () => {
    // Authenticated as Tenant A, attempting to upload into Tenant B's storage folder
    const res = validateFileUpload(tenantA, `${tenantB}/proofs`, 'site_photo.jpg', 'image/jpeg', 2048);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('CROSS_TENANT_STORAGE_VIOLATION');
  });

  it('blocks dangerous executable extensions even if disguised with image MIME types', () => {
    const dangerousFiles = [
      'malware.exe',
      'exploit.sh',
      'webshell.php',
      'script.bat',
      'payload.py',
      'bypass.js',
    ];

    for (const file of dangerousFiles) {
      const res = validateFileUpload(tenantA, `${tenantA}/proofs`, file, 'image/jpeg', 4096);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('DANGEROUS_FILE_EXTENSION');
    }
  });

  it('rejects unapproved MIME types', () => {
    const res = validateFileUpload(
      tenantA,
      `${tenantA}/proofs`,
      'archive.zip',
      'application/zip',
      1024
    );
    expect(res.valid).toBe(false);
    expect(res.error).toContain('ILLEGAL_MIME_TYPE');
  });

  it('strictly enforces the 15MB file size boundary', () => {
    const oversizedBytes = 16 * 1024 * 1024; // 16MB
    const res = validateFileUpload(
      tenantA,
      `${tenantA}/proofs`,
      'large_photo.jpg',
      'image/jpeg',
      oversizedBytes
    );
    expect(res.valid).toBe(false);
    expect(res.error).toContain('FILE_TOO_LARGE');
  });

  it('accepts legitimate proof photos within size, MIME, and path constraints', () => {
    const res = validateFileUpload(
      tenantA,
      `${tenantA}/proofs`,
      'meter_reading_verified.jpg',
      'image/jpeg',
      1024 * 1024 // 1MB
    );
    expect(res.valid).toBe(true);
  });
});
