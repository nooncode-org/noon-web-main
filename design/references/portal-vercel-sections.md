# Client Portal — Vercel sections review (1×1)

Registro vivo del análisis de secciones del dashboard de Vercel para decidir qué
adopta/adapta/salta el **portal del cliente** (`/maxwell/workspace/[sessionId]`).
Se va sumando una entrada por sección que el owner mande.

> Objetivo: **tomar la idea, no copiar el diseño**. Todo se adapta a nuestro
> sistema -rd (Geist, tokens, cards ~6px, nuestros componentes).

---

## Lente de producto que enmarca TODO (clave)

- Tras el pago, **una IA termina el MVP del proyecto y lo deja VIVO en Vercel
  (cuenta de Noon)** — funcional, en línea. El portal muestra **el producto vivo
  del cliente**, no un mockup.
- Reparto de responsabilidades: el **website** llega hasta la propuesta; el
  **App (nooncode-app)** hace build + hosting + emite el feed. El portal es
  **consumidor** de ese feed (`versions[]` con `previewUrl`/`publishedUrl`,
  milestone `version-ready`, project-status).
- **Regla de oro:** no diseñar UI para datos que el App no emite todavía. Si algo
  requiere un dato nuevo (ej. tráfico, dominio), primero lo tiene que emitir el App.

### Los 3 filtros por elemento
1. **¿Le sirve al CLIENTE?** (Vercel es para developers/ops; nuestro usuario es un
   cliente siguiendo su MVP). Lo dev/ops se descarta aunque se vea lindo.
2. **¿Encaja en nuestro sistema?** (-rd, Geist, componentes propios).
3. **Veredicto:** ✅ Adoptar · 🟡 Adaptar (idea, no diseño) · ❌ Saltar.

---

## §1 — "Production Deployment" card

**Mapea a:** nuestro hero **"Latest version"** del tab Overview — **ya construido**
como adaptación de este card (preview a la izq + metadata a la derecha + header con
acciones). Reencuadre: con el MVP vivo, este card = **el producto del cliente en
línea**, y **"Live site / Visit" es el protagonista** (el momento del pago hecho
realidad), no un detalle.

| Elemento de Vercel | Veredicto | Nota |
|---|---|---|
| Thumbnail del sitio | ✅ Ya (adaptar a captura real) | Hoy wireframe; en prod = captura/iframe del MVP vivo |
| Metadata (URL/estado/fecha) | ✅ Ya | Live site · Version · Updated · Proposal |
| Status ● Ready | ✅ Ya | Chip "In Development" + resumen al pie |
| **Visit** (botón) | 🟡 Adaptar | "Visit live" prominente cuando hay `publishedUrl` |
| Repository (GitHub) | ❌ Saltar | El cliente no gestiona el repo |
| Source: branch + commit hash | ❌ Saltar | Puro dev; un hash no le dice nada al cliente |
| Deployment (URL cruda .vercel.app) | ❌ Saltar | Ruido técnico; "Live site" ya da la URL amable |
| Domains (+) | 🟡 Futuro | Dominio propio sobre el MVP vivo (lo gestiona Noon) |
| Instant Rollback (self-serve) | ❌ Saltar | Mantenemos "Request rollback" mediado por staff |
| Deployment Settings / 4 Recommendations | ❌ Saltar | Config y sugerencias de ops de Vercel |
| Sparkline analytics (top-right) | 🟡 Futuro | Tráfico del MVP vivo = valor para el cliente (no ops) |
| Footer "push to main" + Deployments | 🟡 Adaptar | La idea: link **"View all versions →"** al tab Versions |

**Notas de diseño (§1):**
- **Estado building → live:** el hero debe cambiar limpio entre "estamos
  construyendo tu MVP" (milestone Preparing) y "tu MVP está en vivo · Visit"
  (`publishedUrl`). Es el momento estrella del portal.
- **Thumbnail real reconsiderado:** el miedo a "preview en blanco" era por URLs de
  prototipo efímeras; un **MVP estable en Vercel** hace viable el iframe/captura
  en vivo. Revisar al cablear prod.
- **Toque de producto:** cuando el MVP se pone en vivo por 1ª vez, que se sienta
  "¡está en vivo!" (pequeño delight), no un link utilitario.

**To-do que salió de §1** (pendiente de aplicar, no urge):
- [ ] Hero: "Visit live" prominente cuando hay `publishedUrl`.
- [ ] Hero: link "View all versions →" al tab Versions.
- [ ] Hero: transición clara building → live.
- [ ] (Prod) Thumbnail = captura/iframe del sitio vivo.
- [ ] (Futuro, gated en el App) Analytics/tráfico del MVP · dominio propio.

---

## §2 — Fila "Checklist · Observability · Analytics" + "Active Branches"

De 4 sub-secciones, **3 ya las cubrimos o son ops**; la única que suma es Analytics.

| Sub-sección de Vercel | Veredicto | Nota |
|---|---|---|
| **Production Checklist 2/5** | ✅ Ya = **Milestones** | El concepto (checklist de progreso) ya está: Kickoff·First preview·Delivery·Live. Items Vercel (git, Speed Insights) ❌ ops |
| **Observability** (Edge Requests, Function Invocations, Error Rate) | ❌ Saltar | Métricas de infra, no de cliente |
| **Analytics** (visitas, páginas top, tráfico) | 🟡 **Adoptar — futuro** | **La única que suma.** Con MVP vivo, "¿cuánta gente usa mi producto?" = valor real |
| **Active Branches** (branches/commits/source) | ✅ Ya = **Versions** | La estructura (lista de builds con preview+fecha+estado) ya está. Git branches/commits ❌ dev |

**Analytics / tráfico del MVP (lo que sí adoptaríamos):**
- Adaptado (no el de Vercel dev-oriented): "tu MVP en uso" — visitas, páginas más
  vistas, tendencia. Card en Overview o tab "Analytics" cuando haya datos.
- ⚠️ **Gated en el App:** los datos de tráfico viven en Vercel; el App (dueño de la
  cuenta/deploy) tiene que **jalarlos y emitirlos** al portal. Sin eso, NO se
  construye (nada de datos falsos). → **dependencia a pedirle al App.**

**Nota menor:** de Observability, el único con sombra client-facing sería un
"tu sitio está sano ●" (uptime/health), pero el chip de Status ya cubre eso → por ahora no.

**To-do que salió de §2:**
- [ ] (Futuro, gated en el App) Analytics/tráfico del MVP client-facing.
- [ ] Pedirle al App que exponga los datos de Vercel Analytics del deploy del cliente.

---

## §3 — "Deployments" (lista/historial completo)

Otra vista de lo mismo que §2 (Active Branches): el **historial de deployments** →
nuestro tab **Versions**, **ya resuelto**. Diferencia clave (y correcta): Vercel
lista **cada commit**; nosotros solo **versiones client-visibles** (el App filtra
con su allowlist `ready_for_client_preview`/`published`). El cliente NO ve commits
internos → **no adoptamos esa granularidad, la nuestra es la correcta.**

| Elemento | Veredicto |
|---|---|
| Lista de builds | ✅ Ya = Versions (más gruesa a propósito) |
| Commit msgs · hash · branch · author | ❌ Saltar — dev/git |
| Build time · badge Production/Preview | ❌ Saltar (ya hay chips de estado) |
| Filtros (branches/authors/env/date) | ❌ Saltar (un cliente no tiene decenas de versiones) |
| Retention · Recently Deleted | ❌ Saltar — ops |
| Load More / paginación | 🟡 Futuro menor (si la lista crece con la membresía) |

**La adaptación que SÍ vale: "qué cambió" por versión.**
En vez de commits crudos, un **changelog amable por versión** ("v2: se agregó la
vista de envíos en vivo…"). Es lo que el cliente quiere saber. Hoy Versions solo
muestra estado + preview link. ⚠️ **Gated en el App:** necesita que emita un
**resumen/changelog por versión**. Sin eso, no se inventa.

**To-do que salió de §3:**
- [ ] (Futuro, gated en el App) "Qué cambió" / changelog corto por versión en el tab Versions.
- [ ] (Futuro menor) Load More / agrupar por fecha si la lista de versiones crece.

---

## §4 — Triage de la NAV lateral de Vercel (qué vale revisar)

En vez de capturar cada detalle, triamos la nav. Resultado:

- ❌ **Saltar (dev/ops/infra):** Logs · Observability · Firewall · CDN ·
  Environment Variables · Connect · Integrations · Storage · Flags · Agent ·
  AI Gateway · Sandboxes · Workflows · Images. Un cliente nunca toca esto.
- ✅ **Revisar a fondo (valor real):**
  - **Analytics** 🎯 — tráfico/uso del MVP vivo = valor cliente + palanca de
    membresía (ya flagged §1/§2). PRÓXIMA a revisar en detalle.
  - **Domains** — dominio propio del cliente sobre el MVP vivo (ya flagged §1).
- 🟡 **Por encima / ya cubierto:** Speed Insights (señal "tu sitio es rápido/sano",
  opcional) · Support (ya = Contact team) · Settings/Usage (billing ya en la card
  Plan; solo faltaría prefs de cuenta/notif, bajo).
- El banner "Action Required: billing address" ya lo cubre nuestro estado de
  membresía + Stripe portal.

**Decisión:** revisar **Analytics** y **Domains**; el resto, saltado.

---

## §5 — Analytics 🎯 (la ganadora)

Vercel: Visitors · Page Views · Bounce Rate + gráfico de tráfico en el tiempo +
top pages + privacy-respecting. **Adaptación client-facing** ("tu MVP en uso"):

| Métrica | ¿La usamos? |
|---|---|
| Visitors | ✅ "cuánta gente entró a tu MVP" |
| Page Views | ✅ intuitivo |
| Top pages | ✅ "qué miran más", legible para no-técnico |
| Gráfico de tendencia | ✅ la historia de crecimiento (momento emocional) |
| Bounce Rate | 🟡 jerga; secundario o fuera |
| "Respeta privacidad" | ✅ sello de confianza + ordena lo legal |

- Frase-resumen amable arriba: "Tu MVP tuvo 1,200 visitas esta semana (↑12%)" →
  **esto sostiene la membresía** (palanca de negocio, ya notado §2).
- ⚠️ **Gated en el App (2 pasos):** (1) el App activa Vercel Analytics en el deploy
  del cliente, (2) jala datos vía API de Vercel y los emite en el feed. Recién ahí
  se pinta. **Chart en estilo -rd (cargar skill `dataviz` al construirlo). Sin datos falsos.**

## §6 — Domains 🟡 (menor, casi cubierto)

Vercel: gestión de dominios (Add Existing / Buy / Edit DNS). El cliente **ya ve su
URL** (el "Live site" del hero) → eso cubre el 90%.
- Configurar DNS / comprar dominio ❌ — técnico, no self-serve para un cliente.
- Dominio propio 🟡 → como un **"Request custom domain"** (pedido → Noon configura,
  modelo rollback) o directo con el PM. NO una UI de gestión de dominios.
- ⚠️ El App ya sabe el dominio (`publishedUrl`); un custom lo setea Noon (ops), el
  portal solo lo muestra.

**Resolución §6 (2026-07-16, DONE — 2 iteraciones).** Yo recomendé card-no-tab
(el cliente no gestiona DNS), pero el owner aclaró que quería el dominio **en el
hero (fila estilo Vercel) Y también un tab propio**. Se hizo eso: (1) el URL vive
en el hero como `Meta label="Live site"` (glance rápido); (2) **tab "Domain"**
(Overview·Versions·Materials·**Domain**·Requests, condicional a `publishedUrl`) con
la dirección + ● Live + "Use your own domain" → "Request a custom domain"
(contacto, inquiry `custom-domain`, Noon setea el DNS). La card intermedia se
revirtió. Real + mock. tsc + 1044 tests OK. (Nota: 5 tabs — el owner aceptó
re-sumar uno acá aunque habíamos consolidado a 4.)

**To-do que salió de §5/§6:**
- [x] Dominio en hero + tab "Domain" (hecho — real + mock).
- [ ] (Futuro, gated en el App) Analytics client-facing: Visitors · Page Views ·
      Top pages · trend chart + frase-resumen. Cargar `dataviz` al construir.
- [ ] Pedirle al App: activar Vercel Analytics + emitir tráfico en el feed.

---

<!-- §7, §8, … se agregan debajo a medida que el owner mande cada sección -->
