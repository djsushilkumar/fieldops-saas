# FieldOps — CI/CD Pipeline & Quality Automation

---

## 1. CI/CD Architecture Flow

```mermaid
flowchart TD
    subgraph PullRequest["Pull Request Phase"]
        PushCode["Developer Pushes Feature Branch"] --> TriggerCI["GitHub Actions Triggered"]
        
        subgraph ParallelGates["Automated Quality Gates"]
            NodeGate["Web & Packages Gate\n- pnpm install\n- pnpm typecheck\n- pnpm test (Vitest)\n- pnpm build"]
            FlutterGate["Mobile Gate\n- flutter pub get\n- flutter analyze --fatal-infos\n- flutter test"]
            SecurityGate["Security Scan Gate\n- Secret leak detection\n- SAST scan"]
        end
        
        TriggerCI --> NodeGate
        TriggerCI --> FlutterGate
        TriggerCI --> SecurityGate
    end

    subgraph MergeMain["Main Branch (Staging)"]
        NodeGate & FlutterGate & SecurityGate --> BranchApproved["PR Approved & Merged"]
        BranchApproved --> AutoDeployStaging["Automated Deploy to Staging"]
    end

    subgraph ReleaseProd["Production Release"]
        AutoDeployStaging --> StagingValidation["Staging E2E Smoke Tests"]
        StagingValidation --> TagRelease["Create Git Release Tag (vX.Y.Z)"]
        TagRelease --> DeployProd["Production Gated Deployment"]
    end
```

---

## 2. Non-Negotiable CI Rules

1. **Zero Warnings as Errors**: TypeScript compiler errors, ESLint errors, and Flutter analysis warnings must cause the CI pipeline to fail.
2. **Never Bypass CI**: Merging code with failing checks or bypassing branch protection is strictly prohibited.
3. **Reproducible Builds**: All builds utilize frozen lockfiles (`pnpm-lock.yaml`) and pinned SDK versions.
