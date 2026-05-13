# Maxwell Error Codes

This document defines the public `data.code` values used by Maxwell-facing APIs. Client UI must map these codes to friendly messages and never expose raw infrastructure errors.

## Chat

| Code | HTTP | Meaning |
|---|---:|---|
| `AUTH_REQUIRED` | 401 | The viewer must sign in before continuing. |
| `FORBIDDEN` | 403 | The viewer is authenticated but does not own this session. |
| `SESSION_NOT_FOUND` | 404 | The referenced studio session does not exist or is unavailable. |
| `SESSION_NOT_ACCEPTING_MESSAGES` | 409 | The current session state cannot accept a new message. |
| `REPLY_TARGET_NOT_FOUND` | 404 | The reply target message is missing. |
| `INVALID_REPLY_TARGET` | 400 | The reply target is not a valid Maxwell response. |
| `REGENERATE_TARGET_NOT_FOUND` | 404 | The regenerate target message is missing. |
| `INVALID_REGENERATE_TARGET` | 400 | The regenerate target is not a valid Maxwell response. |
| `LATEST_RESPONSE_REQUIRED` | 409 | Only the latest assistant response can be regenerated. |
| `INVALID_REQUEST` | 400 | The request body failed validation. |
| `REQUEST_ABORTED` | 499 | The client aborted the request. |
| `OPENAI_NOT_CONFIGURED` | 503 | AI generation is not configured on this runtime. |
| `DB_CONNECTIVITY_ERROR` | 503 | Database connectivity timed out or failed transiently. |
| `MAXWELL_CHAT_FAILED` | 500 | Unknown normalized chat failure. |

## Payment Evidence

| Code | HTTP | Meaning |
|---|---:|---|
| `AUTH_REQUIRED` | 401/403 | The viewer must own the proposal or be an authorized reviewer. |
| `PROPOSAL_NOT_FOUND` | 404 | The proposal token or ID does not exist. |
| `SESSION_NOT_FOUND` | 404 | The proposal's studio session is missing. |
| `PROPOSAL_ALREADY_PAID` | 409 | The proposal is already paid. |
| `PROPOSAL_EXPIRED` | 410 | The proposal has expired. |
| `PROPOSAL_NOT_PAYABLE` | 409 | The proposal is not in a payable state. |

## Client Rules

- `401` should redirect the user to `/en/signin` with a `callbackUrl`.
- `403` should show an access message, not a login loop.
- Retryable operational failures should keep the current session intact.
- Payment evidence is idempotent by `manual-evidence:<proposal_request_id>`.
