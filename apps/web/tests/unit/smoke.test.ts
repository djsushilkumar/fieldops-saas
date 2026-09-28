import { describe, it, expect } from 'vitest';
import { cn } from '../../src/lib/utils';
import { getApiClient } from '../../src/lib/api';

describe('Web Application Foundation Smoke Test', () => {
  it('combines css class names correctly via cn utility', () => {
    const className = cn('p-4', 'bg-primary', false && 'hidden', 'text-white');
    expect(className).toBe('p-4 bg-primary text-white');
  });

  it('instantiates FieldOpsApiClient successfully in web context', () => {
    const client = getApiClient();
    expect(client).toBeDefined();
  });
});
