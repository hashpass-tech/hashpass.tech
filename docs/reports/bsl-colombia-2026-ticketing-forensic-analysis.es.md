# Análisis forense funcional del nuevo ticketing de BSL Colombia 2026

**Fecha de observación:** 5 de septiembre de 2026
**Alcance:** recorrido público, selección, creación de checkout y llegada a Wompi. No se ingresaron medios de pago ni se intentó cobrar.
**Objetivo:** documentar el sistema observable sin pruebas intrusivas y convertir los hallazgos en requisitos de interoperabilidad para HashPass.

## Resumen ejecutivo

BSL ya opera un embudo propio, claro y corto: su página WordPress dirige a `bsl.blckchn.xyz`, una aplicación Next.js desplegada en Vercel; el servidor conserva la selección, recibe los datos del comprador, crea una orden y entrega un checkout firmado de Wompi. La navegación hasta Wompi funcionó correctamente con una boleta General de COP 89.000.

La solución es una buena base comercial, pero hoy parece diseñada como aplicación cerrada, no como plataforma interoperable. El navegador sólo expone una acción interna de Next.js y `POST /api/checkout`; no se observó una API pública versionada, contrato OpenAPI, autenticación de integraciones, idempotencia visible, webhooks documentados ni un mecanismo para que HashPass emita o sincronice tickets. La prioridad conjunta debe ser conservar a BSL como dueño del checkout y hacer de HashPass el plano interoperable de credenciales, entrega y validación.

## Evidencia observable

### Arquitectura y recorrido

1. `blockchainsummit.la/colombia2026/` responde como WordPress/PHP en Hostinger.
2. `bsl.blckchn.xyz/e/bsl-colombia-2026` responde como Next.js en Vercel (`x-matched-path: /e/[slug]`) y marca el evento como **Publicado**.
3. El catálogo renderizado por servidor ofrece General/Early Bird I, Business y VIP en COP, inventario restante y máximo de 20 unidades por pedido.
4. La selección se envía como una Server Action de Next.js y lleva a `/checkout`.
5. Checkout solicita nombre, correo, teléfono, tipo y número de documento.
6. `POST /api/checkout` recibe los datos del comprador. Su respuesta crea/redirige a un enlace firmado de Wompi con moneda, monto, referencia, firma de integridad y URL de retorno.
7. Wompi reconoció al comercio como Blockchain Summit Latam y ofreció transferencia, tarjeta débito/crédito y crédito. La prueba terminó allí.

### Controles positivos

- El precio y total se calculan en centavos enteros; el cliente rechaza flotantes y desbordes.
- La cantidad está acotada por disponibilidad y máximo por orden.
- El importe de Wompi coincidió exactamente con COP 89.000.
- La firma de integridad protege los parámetros económicos entregados a Wompi.
- El checkout usa HTTPS/HSTS y evita cachear páginas privadas.
- El comprador no ve secretos privados de Wompi; la llave que aparece en el redirect es una llave pública de producción.

## Riesgos y oportunidades

| Prioridad | Hallazgo | Impacto | Recomendación |
|---|---|---|---|
| P0 | La URL de retorno apunta a `tik-bsl.vercel.app`, no al dominio público `bsl.blckchn.xyz`. | Confianza, continuidad de sesión, analítica y allowlists pueden divergir. | Canonicalizar el retorno al dominio BSL y probar éxito, pendiente, rechazo, expiración y reintento. |
| P0 | No hay contrato público observable para emisión/sincronización de tickets. | Integraciones ad hoc, duplicados y soporte manual. | API v1 OpenAPI 3.1 con claves por entorno, OAuth2 para apps avanzadas, idempotencia y webhooks firmados. |
| P0 | El flujo probado usa Wompi producción para QA. | Las pruebas crean órdenes pendientes reales y contaminan métricas. | Separar sandbox/producción de extremo a extremo y etiquetar órdenes de prueba. |
| P1 | Los datos personales se envían antes de Wompi, sin aviso de privacidad visible en el formulario observado. | Riesgo de consentimiento, retención y minimización. | Enlazar política, declarar finalidad/retención y reducir documento obligatorio según necesidad legal. |
| P1 | El HTML de ticketing no mostró una CSP completa ni cabeceras explícitas contra framing/sniffing. | Mayor superficie XSS/clickjacking. | CSP con nonces, `frame-ancestors`, `X-Content-Type-Options`, Referrer/Permissions Policy. |
| P1 | La Server Action lleva un identificador de build y el checkout depende de estado previo. | Clientes externos no pueden integrar de forma estable. | Recursos REST estables (`orders`, `tickets`, `attendees`) y respuestas autocontenidas. |
| P1 | No se observó estado de consentimiento para analítica; Wompi cargó Google/DoubleClick/LinkedIn. | Privacidad y atribución transfronteriza. | Validar CMP/consent mode y documentar subprocessors. |
| P2 | Texto largo de cada ticket y control +/- elevan el esfuerzo móvil. | Conversión y accesibilidad. | Resumen plegable, input numérico accesible, errores inline y pruebas WCAG 2.2 AA. |

## Modelo de interoperabilidad propuesto

### División de responsabilidades

- **BSL:** catálogo, precios, inventario comercial, orden, Wompi, reembolsos y verdad del pago.
- **HashPass:** identidad interoperable, emisión/revocación del ticket digital, wallet/QR, check-in, auditoría y métricas operativas.
- **Contrato:** BSL llama `POST /v1/events/{eventId}/tickets` después de pago aprobado con `Idempotency-Key`; HashPass devuelve `201` o reproduce la misma respuesta. HashPass firma webhooks de cambios. Nunca se emite por un redirect del navegador: sólo por confirmación servidor-a-servidor/verificación del pago.

### Seguridad mínima

1. Claves opacas almacenadas sólo como hash, secreto mostrado una vez, prefijo identificable y rotación solapada.
2. Claves distintas `test`/`live`, scopes mínimos (`tickets:write`, `tickets:read`, `checkins:write`, `webhooks:manage`) y restricción por organización/evento.
3. Rate limit por principal, IP y ruta; `429` con `Retry-After`.
4. Idempotencia obligatoria en mutaciones, retención mínima 24 h y detección de reutilización con payload distinto.
5. Webhooks HMAC SHA-256 con timestamp, tolerancia de cinco minutos, protección contra replay y reintentos exponenciales.
6. Auditoría inmutable de creación, lectura sensible, rotación, revocación, emisión y check-in.
7. El API nunca recibe datos de tarjeta ni secretos Wompi; sólo referencias y estados verificados.

## Panel de desarrolladores y métricas

Recomendación de nombre: **HashPass Developers** en `developers.hashpass.tech`, separado del panel operativo de eventos en `club.hashpass.tech/admin`. El primero administra organizaciones, aplicaciones, entornos, claves, scopes, webhooks, logs y uso; el segundo administra catálogo, asistentes, tickets y check-ins. Ambos comparten identidad, RBAC por evento y auditoría.

Métricas iniciales: solicitudes/errores/latencia p50-p95-p99, consumo de rate limit, idempotency replays/conflicts, entregas y reintentos de webhook, tickets emitidos/revocados, tiempo pago→emisión, check-ins/duplicados, actividad por clave y último uso. Nunca mostrar secretos o PII completa en logs.

## Plan ASAP

- **0–48 h:** aprobar contrato OpenAPI, modelo de identidad/scopes, sandbox BSL y canonicalización del retorno Wompi.
- **Semana 1:** claves test, emisión idempotente, consulta/revocación, webhook firmado y colección de pruebas contractuales.
- **Semana 2:** panel Developers mínimo (crear/rotar/revocar clave, webhook y logs) y adaptador BSL en sandbox.
- **Semana 3:** prueba de carga/tenant isolation, runbooks, pentest focalizado y piloto producción con límites bajos.
- **Semana 4:** métricas/SLO, autoservicio controlado y SDKs TypeScript + ejemplos curl/Python/PHP.

## Criterios de aceptación del piloto BSL

- Cero emisiones duplicadas bajo 20 reintentos concurrentes con la misma idempotency key.
- p95 menor a 500 ms para aceptar una emisión (sin contar procesamiento asíncrono) y disponibilidad mensual objetivo 99,9%.
- Separación test/live y tenant BSL verificada por pruebas negativas.
- Rotación de clave sin interrupción y revocación efectiva en menos de 60 segundos.
- Webhook verificable, reproducible desde el panel y entregado al menos una vez.
- Reconciliación automática entre pagos aprobados, tickets emitidos y check-ins; alertas ante discrepancias.

## Limitaciones

Este es un análisis de caja negra y no afirma cómo están implementados la base de datos, los webhooks de Wompi o los controles internos. No se completó un pago, no se probaron ataques, no se inspeccionaron áreas autenticadas y no se debe interpretar la ausencia de un control visible como prueba de que no existe en servidor.
