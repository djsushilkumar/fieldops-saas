import { ErrorCode } from '@fieldops/types';

export const MAX_REPORT_EXPORT_ROWS = 5000;

export interface CsvBuildOptions {
  readonly sanitizeFormulas?: boolean;
}

/**
 * Escapes an individual cell value according to RFC 4180 and spreadsheet safety standards.
 */
export function escapeCsvCell(value: unknown, sanitizeFormulas: boolean = true): string {
  if (value === null || value === undefined) {
    return '';
  }

  let str = String(value);

  // Sanitize spreadsheet formula injection (=, +, -, @, \t, \r)
  if (sanitizeFormulas && str.length > 0) {
    const firstChar = str.charAt(0);
    if (firstChar === '=' || firstChar === '+' || firstChar === '-' || firstChar === '@' || firstChar === '\t') {
      str = `'${str}`;
    }
  }

  // If cell contains quotes, commas, newlines, or carriage returns, wrap in quotes and escape internal quotes
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Builds an RFC 4180 compliant CSV string with a UTF-8 Byte Order Mark (BOM).
 */
export function buildCsv(
  headers: readonly string[],
  rows: readonly (readonly unknown[])[],
  options?: CsvBuildOptions
): string {
  if (rows.length > MAX_REPORT_EXPORT_ROWS) {
    throw new Error(
      `Export row count (${rows.length}) exceeds the maximum allowed limit of ${MAX_REPORT_EXPORT_ROWS}. Please refine your date range or filter criteria.`
    );
  }

  const sanitize = options?.sanitizeFormulas ?? true;
  const headerLine = headers.map((h) => escapeCsvCell(h, sanitize)).join(',');
  const rowLines = rows.map((row) => row.map((cell) => escapeCsvCell(cell, sanitize)).join(','));

  // Prepend UTF-8 BOM (\uFEFF) for Microsoft Excel compatibility
  return `\uFEFF${[headerLine, ...rowLines].join('\r\n')}`;
}
