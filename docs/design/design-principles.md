# FieldOps — User Experience (UX) Principles

---

## 1. UX Mission

FieldOps exists to serve workers operating in demanding physical environments and managers orchestrating complex operational dispatch. The interface must be fast, dependable, unambiguous, and respectful of the human operator's time and cognitive bandwidth.

---

## 2. The Eight Core UX Principles

### Principle 1: Action First
- **Field Context**: When a technician opens the application, they are usually standing on a job site, climbing a ladder, or sitting in a service van. They do not want to browse; they want to act.
- **Rule**: The primary next action (e.g., "Check In", "Start Task", "Clock In") must be immediately accessible from the primary viewport with zero unnecessary clicks or deep navigation. Secondary administrative actions are deferred to overflow menus.

### Principle 2: Minimal Cognitive Load
- **Field Context**: Field personnel often work in high-stress, noisy, or extreme temperature conditions wearing protective gear. Complex multi-step wizards or cluttered forms lead to mistakes.
- **Rule**: Eliminate decorative UI elements. Group form inputs into progressive disclosure sections. Show only the data required to execute the current step. Never present a mobile worker with a 30-field unbounded form.

### Principle 3: Operational Clarity
- **Management Context**: Dispatchers and operations managers monitor dozens of field visits and emergency service calls simultaneously. They cannot afford to hunt through dense menus to find emergencies.
- **Rule**: Dashboards must surface actionable exceptions first: overdue tasks, blocked technicians, out-of-bounds geofence check-ins, and missed clock-ins. Visual hierarchy must guide the manager's attention directly to bottlenecks.

### Principle 4: Explicit Status
- **System Context**: Ambiguous status indicators create panic and operational confusion ("Did my check-in count?", "Is the client waiting?").
- **Rule**: Never hide, obscure, or soften system state. Use unambiguous, standardized status badges with distinct colors, shapes, and clear labels (`DRAFT`, `ASSIGNED`, `ACCEPTED`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`, `CANCELED`). Every state transition must be clearly reflected in the UI within 100ms.

### Principle 5: Strong Feedback
- **Field Context**: Operating devices under bright glare or with wet fingers can leave workers unsure if a button tap registered.
- **Rule**: Every user interaction must produce immediate sensory confirmation: visual state change, micro-animation, clear toast notification, and haptic feedback (on mobile). Destructive or irreversible actions require an explicit confirmation sheet.

### Principle 6: Offline Transparency
- **System Context**: Field workers frequently pass in and out of cellular connectivity. Silent sync failures or mysterious spinners destroy trust in software.
- **Rule**: The interface must always communicate network and synchronization status explicitly:
  - **Online & Synced**: Subtle green indicator ("All changes synced").
  - **Syncing**: Active progress animation with item count ("Syncing 2 of 4 items...").
  - **Offline**: High-visibility amber status badge ("Offline • 3 changes queued").
  - **Sync Failed**: Clear alert banner with explanatory error and a single-tap "Retry Sync" action.
  - *Never silently drop a field technician's recorded work.*

### Principle 7: Permission Transparency
- **Privacy & Compliance Context**: Requesting location and camera permissions without context induces anxiety and triggers OS permission denials.
- **Rule**: Before triggering native OS permission modals, the app must present an educational pre-permission card explaining *why* the permission is required for their job (e.g., "FieldOps requires precise location only when you check in to verify site arrival. We never track your personal time.").

### Principle 8: Accessibility & Physical Ergonomics
- **Environmental Context**: Field technicians operate in direct sunlight, in dim mechanical rooms, and with gloved hands. Managers include operators with varying visual acuity.
- **Rule**:
  - Minimum touch target size on mobile: **48px × 48px** (recommended 56px for primary action buttons).
  - Strict adherence to **WCAG 2.1 AA** contrast ratios (minimum 4.5:1 for body copy; 3:1 for large headers and status badges).
  - High-luminance mode support for outdoor readability.
  - Native screen-reader compatibility (semantic HTML, proper ARIA labels, accessible form inputs).
