import React from 'react';

export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 flex h-14 w-full items-center justify-between border-b border-border bg-surface px-6">
      <div className="flex items-center gap-3">
        <span className="text-base font-bold tracking-tight text-primary">FieldOps</span>
        <span className="rounded bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
          Phase 02 Shell
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-text-muted">
        <span className="inline-block h-2 w-2 rounded-full bg-success" />
        <span>Architecture Foundation Active</span>
      </div>
    </header>
  );
}
