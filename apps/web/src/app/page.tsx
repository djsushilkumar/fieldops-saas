import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="rounded-lg border border-border bg-surface p-8 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-primary">
          FieldOps Engineering Architecture Foundation
        </h1>
        <p className="mt-3 text-sm text-text-muted">
          Active Phase: <strong>Phase 02 — Architecture + Monorepo + Engineering Foundation</strong>.
        </p>
        <div className="mt-6 rounded-md bg-secondary p-4 text-xs text-secondary-foreground">
          <p className="font-semibold">Architectural Invariant:</p>
          <p className="mt-1">
            Business logic, task dispatch, attendance tracking, and live telemetry are deferred to
            subsequent implementation phases per AGENTS.md rules.
          </p>
        </div>
        <div className="mt-6 flex gap-3">
          <Button variant="primary">Architecture Shell Active</Button>
          <Button variant="secondary">Documentation Verified</Button>
        </div>
      </div>
    </div>
  );
}
