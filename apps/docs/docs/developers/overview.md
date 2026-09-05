---
title: Developer Platform / Plataforma para desarrolladores
---

# HashPass Developer Platform

> **Foundation status / Estado de la base:** this contract is the target for the BSL pilot. Endpoints must not be presented as production-ready until their implementation and security gates are complete. / Este contrato es el objetivo del piloto BSL. No se deben presentar los endpoints como listos para producción hasta completar implementación y controles.

HashPass exposes event ticket issuance as an interoperable, payment-provider-neutral API. The payment system remains the source of truth for payment; HashPass issues a credential only after a trusted server confirms approval.

HashPass expone la emisión de tickets como API interoperable e independiente del proveedor de pagos. El sistema de pagos mantiene la verdad del pago; HashPass emite una credencial únicamente cuando un servidor confiable confirma su aprobación.

## Environments / Entornos

| Mode | Base URL | Data |
|---|---|---|
| Test | `https://api-dev.hashpass.tech/v1` | Synthetic only / Sólo datos sintéticos |
| Live | `https://api.hashpass.tech/v1` | Production / Producción |

Keys never cross environments. Never place a secret key in a browser, mobile binary, URL, screenshot or support ticket.

Las claves nunca cruzan entornos. Nunca incluya una clave secreta en navegador, binario móvil, URL, captura o ticket de soporte.

## First issuance / Primera emisión

```bash
curl --request POST 'https://api-dev.hashpass.tech/v1/events/evt_bsl_colombia_2026/tickets' \
  --header 'Authorization: Bearer hp_test_REPLACE_ME' \
  --header 'Idempotency-Key: order-123-ticket-1' \
  --header 'Content-Type: application/json' \
  --data '{
    "externalReference":"order-123-ticket-1",
    "ticketTypeId":"general",
    "attendee":{"email":"attendee@example.com","fullName":"Ada Ejemplo"},
    "payment":{"provider":"wompi","reference":"provider-reference","status":"approved"}
  }'
```

Never infer approval from the customer redirect. Confirm it server-to-server with the payment provider before calling HashPass. / Nunca infiera aprobación desde el redirect del comprador. Confírmela servidor-a-servidor con el proveedor antes de llamar a HashPass.

## Required protocol / Protocolo obligatorio

- Send an `Idempotency-Key` on every mutation. Reuse with the same body returns the original result; reuse with a different body returns `409`.
- Preserve `X-Request-Id` for support and tracing.
- Treat `429` and `5xx` as retryable using exponential backoff and jitter. Do not blindly retry other `4xx` responses.
- Store only the key prefix and last four characters in UI/logs.
- Use least-privilege scopes. The pilot issuance key needs only `tickets:write` and optionally `tickets:read`.

## Webhook verification / Verificación de webhooks

HashPass sends `Webhook-Id`, `Webhook-Timestamp`, and `Webhook-Signature`. Compute HMAC-SHA256 over `id.timestamp.rawBody`, compare in constant time, reject timestamps older than five minutes, and persist `Webhook-Id` to reject replay. Return `2xx` quickly and process asynchronously.

HashPass envía `Webhook-Id`, `Webhook-Timestamp` y `Webhook-Signature`. Calcule HMAC-SHA256 sobre `id.timestamp.rawBody`, compare en tiempo constante, rechace timestamps con más de cinco minutos y persista `Webhook-Id` para impedir replay. Responda `2xx` rápido y procese asíncronamente.

## API description

The normative OpenAPI 3.1 source is [`static/openapi/hashpass-events-v1.yaml`](pathname:///openapi/hashpass-events-v1.yaml). It defines authentication, scopes, idempotency, error shape, pagination and the initial ticket lifecycle.

La fuente normativa OpenAPI 3.1 es [`static/openapi/hashpass-events-v1.yaml`](pathname:///openapi/hashpass-events-v1.yaml). Define autenticación, scopes, idempotencia, errores, paginación y el ciclo inicial del ticket.
