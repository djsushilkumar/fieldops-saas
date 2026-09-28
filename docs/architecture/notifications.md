# FieldOps — Notification Architecture & Dispatch Abstraction

---

## 1. Architectural Philosophy

FieldOps abstracts notification delivery behind a decoupled **`NotificationService`** interface. Business domain logic (e.g. task assignment or exception alerting) emits high-level domain events rather than interacting directly with vendor SDKs (Firebase Cloud Messaging, Apple Push Notification service, SendGrid, or Twilio).

```
Domain Event (TaskAssigned)
  └── NotificationService
        ├── InAppProvider (WebSocket real-time toast / notification center)
        ├── PushProvider (FCM / APNs for mobile field alerts)
        └── EmailProvider (Transactional operational reports)
```

---

## 2. Notification Service Contract

```typescript
export interface NotificationPayload {
  readonly recipientUserId: string;
  readonly tenantId: string;
  readonly title: string;
  readonly body: string;
  readonly category: 'DISPATCH' | 'EXCEPTION' | 'ATTENDANCE' | 'SYSTEM';
  readonly deepLinkPath?: string; // e.g. /tasks/018f2e23-...
  readonly metadata?: Record<string, unknown>;
}

export interface NotificationService {
  dispatch(payload: NotificationPayload): Promise<void>;
  dispatchBatch(payloads: readonly NotificationPayload[]): Promise<void>;
}
```

---

## 3. Supported Delivery Channels

1. **In-App Realtime**: Delivered via Supabase Realtime / WebSocket to active web and mobile sessions.
2. **Mobile Push (FCM / APNs)**: High-priority data messages triggering native mobile notifications even when the app is in the background.
3. **Email**: Daily digest reports and critical billing notifications sent via transactional email gateways.
