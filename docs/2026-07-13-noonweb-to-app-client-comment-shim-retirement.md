# Handoff — NoonWeb → App: retiro del shim `client-comment` (B.6-followup / Q-7)

**Fecha:** 2026-07-13
**Origen:** noon-web-main (PR del switch del emisor)
**Destino:** App-nooncode
**Protocolo:** done-notification cross-repo (F1-01, adoptado 2026-07-08)

## Qué shippeó NoonWeb

El emisor de comentarios de workspace (`sendClientCommentToNoonApp` en
`lib/noon-app-integration.ts` — cubre el forward inline del server action Y el
re-forward del reaper) dejó de POSTear al shim
`POST /api/integrations/website/client-comment` y ahora usa el receptor
canónico `POST /api/integrations/website/client-request`:

```jsonc
{
  "externalRequestId": "<externalCommentId>", // UUID = client_comment row id, sin cambio
  "projectId": "<uuid>",
  "submittedBy": "client",                    // la constante que el fold ya escribía
  "type": "comment",
  "clientPriority": "normal",
  "body": "<1..2000 chars>",
  "at": "<ISO 8601>"
}
```

- **Dedupe preservado:** `externalRequestId` aterriza en el MISMO
  `client_requests.external_request_id` UNIQUE que el shim mapeaba desde
  `externalCommentId` — un comentario forwardeado pre-switch y re-forwardeado
  post-switch (reaper) replayea idempotente.
- **Ack:** NoonWeb lee el flat §9 `{ idempotent, clientRequestId, requestId }`
  y persiste `clientRequestId` en `client_comment.noon_app_comment_id`
  (es el mismo `client_requests.id` que el shim devolvía como `commentId`).

## Acción requerida en App (DESPUÉS del deploy de este cambio en Web prod)

Borrar el shim B.6 — es el followup declarado en el propio route
(`app/api/integrations/website/client-comment/route.ts`: "NoonWeb MAY later
migrate to posting `client-request type=comment` directly, after which this
shim is removed"):

1. `app/api/integrations/website/client-comment/route.ts`
2. `lib/server/projects/client-messages-repository.ts` (el módulo del fold;
   verificar consumidores restantes antes de borrar)
3. Tests del shim + referencia §5B en `docs/integrations/cross-repo-webhook-v1.md`

**Orden importa:** si App borra el shim ANTES del deploy Web, un comentario
in-flight 404ea — queda dead-letter en el outbox de Web y el reaper lo
re-forwardea por el lane nuevo tras el deploy (auto-sana), pero mejor evitarlo.
