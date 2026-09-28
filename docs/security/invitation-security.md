# FieldOps — Invitation Security & Cryptographic Token Architecture

---

## 1. Threats to User Onboarding

1. **Token Prediction / Brute-Force**: Short or sequential invitation codes could allow attackers to join an organization.
2. **Database Leak Vulnerability**: Storing raw invitation tokens in the database exposes all unaccepted invites to an attacker with database read access.
3. **Replay / Multi-Use Attacks**: Allowing a token to be redeemed multiple times could grant unintended accounts unauthorized access.
4. **Permanent Token Lingering**: Forgotten invitations remaining valid indefinitely increase exposure.

---

## 2. Cryptographic Token Protocol

FieldOps solves these risks using asymmetric token hashing:

1. **High-Entropy Token Generation**:
   A cryptographically secure pseudo-random 32-byte secret is generated:
   `raw_token = crypto.randomBytes(32).toString('hex')` (256 bits of entropy).
2. **One-Way SHA-256 Hashing**:
   Before storing in PostgreSQL, the server hashes the token:
   `token_hash = sha256(raw_token)`.
   The `raw_token` is sent via email or direct link to the user and is **never stored** in the database.
3. **Time-Limited Expiration**:
   Tokens are strictly valid for 7 days (`expires_at = NOW() + INTERVAL '7 days'`).
4. **Single-Use Atomic Transition**:
   Redemption is executed inside an atomic transaction with row locking (`FOR UPDATE`):
   - Confirms `status = 'PENDING'`.
   - Confirms `NOW() < expires_at`.
   - Transitions `status = 'ACCEPTED'` and sets `accepted_at = NOW()`.
   - Creates or updates membership to `ACTIVE`.
   - Any replay attempt fails with `ErrorCode.INVITATION_INVALID`.
