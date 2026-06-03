# Noon Marketing Site — Auditoría profunda de diseño (benchmark Vercel)

**Fecha:** 2026-06-01
**Alcance:** Páginas públicas — Home, /services, /about, /opportunities, /contact, /templates, /templates/[slug], /upgrade + sistema compartido (navbar, footer, FAQ, CTA, tokens, motion).
**Metodología:** 4 agentes auditando Noon página por página + 5 dimensiones de investigación sobre vercel.com (estructura, sistema visual, motion/microinteracciones, trust/conversión, templates/showcase) + contexto del Documento Maestro 2026.
**Regla rectora:** No romper nada de lo que funciona. Esto es **análisis** — la implementación se decide después.

---

## Resumen ejecutivo

La superficie **porteada del Figma** (services/about/contact/opportunities heroes, value props, operating-model, intake form, navbar, footer, tokens) está **bien construida, tokenizada y on-brand**. El riesgo se concentra **casi por completo en la capa que agregó V0** (PR #33): `components/sections/premium/*`, `components/sections/pipeline/*`, las nuevas primitivas `components/ui/*` y los cuerpos de `/upgrade` y `/templates` que las embeben.

**Tesis central:** hoy conviven **dos sistemas de diseño en conflicto**:
- **(A) Figma-canon** — square (0px marcos / 8px inputs), accent único `#1200c5`, Instrument Sans, hairline borders, motion controlado, theme-aware, sin métricas inventadas.
- **(B) Capa V0** — `rounded-2xl`, gradientes multicolor (blue/purple/green/teal/orange/red-500), loops `Infinity` pulsantes, **dark-only** (rompe en light mode), motivos de IDE/terminal de developer, y **métricas fabricadas + frases prohibidas por la marca**.

La capa (B) viola directamente el Documento Maestro en 3 frentes simultáneos: **audiencia** (habla a developers, no a dueños de negocio), **claims** (promesas de velocidad infladas + frases prohibidas como "Full ownership of your code"), y **dirección visual** (gradientes/efectos futuristas/decoración sin propósito que la marca explícitamente prohíbe). Paradójicamente, Vercel —la inspiración declarada de Noon— **es más restringido** que la capa V0 que se agregó "inspirándose" en sitios premium.

**La acción de mayor apalancamiento:** reconciliar o reconstruir la capa V0 al sistema canon. Eso solo resuelve ~70% de los hallazgos críticos. Después, capitalizar lo que Vercel hace de verdad bien (ritmo editorial, motion explicativo de sistemas, credibilidad intercalada) traducido a la identidad de servicios de Noon.

---

## 1. Lo que falta actualmente

### Por página

| Página | Falta | Severidad |
|---|---|---|
| **Home** | Toda la narrativa: es una sola pantalla `h-dvh overflow-hidden` con solo el chat-box. Sin footer, sin secciones, sin historia, sin proof, sin los 4 servicios, sin los mensajes aprobados de marca. *(Nota: puede estar CONGELADO por brief — confirmar antes de tocar.)* | 🔴 crítico\* |
| **Home** | No usa `SitePageFrame` → única página sin footer, sin legal links, sin scroll indicator. | 🟡 medio |
| **Services** | **No es un "decision map"** (requisito de marca). Las relaciones Build path (Custom Dev→Eng Support) e Improvement path (Audit→Upgrade) nunca se visualizan; solo aparecen como prosa, dos veces. | 🟠 alto |
| **Services** | Cada card describe un servicio pero **no enlaza** a nada; las cards del Decision Guide son callejones sin salida (no rutean a contacto/servicio). | 🟡 medio |
| **Opportunities** | **"Next product interest"** falta como track (la marca pide Sellers/Developers/Investors/Next-product). Hay "Partners" agregado fuera de spec. | 🟠 alto |
| **Opportunities** | Sin FAQ, sin i18n (todo hardcoded en inglés) — diverge de /about y /contact. | 🟡 medio |
| **Templates** | Filtro por **categorías de developer** (framework/CSS/database) en vez de las 8 categorías de negocio aprobadas. Falta landing por categoría. | 🟠 alto |
| **Templates detail** | CTA "Deploy" (self-serve, off-model) en vez de "Build something like this" → Maxwell. Sin "View Demo" real ni "Related templates". | 🟠 alto |
| **Contact** | Links sociales son **placeholders** (LinkedIn/GitHub/TikTok → homepages genéricas), y el set no coincide con el de marca (TikTok/FB/IG). | 🟠 alto |
| **Global** | **Sin `prefers-reduced-motion`** en toda la capa de motion nueva (WCAG 2.3.3). | 🟠 alto |
| **Global** | **El variant `dark:` de Tailwind está muerto** — nunca se aplica la clase `.dark` (solo media-query OS swap de tokens). Cada utility `dark:` es un no-op silencioso. | 🟠 alto |
| **Global** | No existe documento de design system (escala de color, tipografía, spacing, radius). Vive implícito en `globals.css`. | 🟡 medio |
| **Global** | Sin página de **case studies / customers** (la prueba social más potente para un comprador de alta consideración — su audiencia se parece al enterprise buyer de Vercel). | 🟠 alto |

\* *Home: severidad condicionada a si el freeze del brief sigue vigente.*

### Funcional / bugs concretos detectados

| Bug | Archivo | Severidad |
|---|---|---|
| `/opportunities` cards NO pre-rutean el inquiry — todas → `inquiry:"general"`, contradiciendo el propio copy "the category tells Noon which conversation to start". | `opportunities/page.tsx:69,160-167` | 🟠 alto |
| Los **3 CTAs finales** linkean a Home en vez de Contact/Maxwell (`blockHref={lp(siteRoutes.home)}`). | about/opportunities/contact | 🟡 medio (×3) |
| FAQ "Ask Maxwell" link **pierde el prefijo de locale** (`siteRoutes.maxwellStudio` sin `lp()`). | `faq-section.tsx:116` | 🟡 medio |
| FAQ answers se cortan a `max-h-48` en respuestas largas. | `faq-section.tsx:72` | 🟡 medio |
| `bg-gradient-radial` no es utility válida de Tailwind v4 y no está definida → el glow **no renderiza** (dead class). | `template-hero-preview.tsx:206` | 🟡 medio |
| Hero CTAs apuntan a `/maxwell/studio` (gated por sign-in) en vez del público `/maxwell`. | templates + varios | 🟠 alto |
| `--destructive-foreground` en light mode = mismo rojo que el fondo → texto invisible. | `globals.css:31-32` | 🟡 medio |
| Per-service `tone` (amber/teal/purple) **computado pero sin usar** — todo forzado a azul uniforme. | `services/page.tsx:288-291` | 🟡 medio |
| `.liquid-glass-nav` definido pero sin usar; `.glow-*` con hue olive incoherente con la marca. | `globals.css` | 🟢 bajo |
| Inbox es `gmail.com` — mina el "premium/institucional". | `lib/contact.ts:3` | 🟡 medio |
| Footer tagline diverge del aprobado y coquetea con "software you own" (cerca de frase prohibida). | `footer-section.tsx:31` | 🟡 medio |
| i18n incompleto: /opportunities, FaqSection, /upgrade, filtros de /templates hardcoded en inglés. | varios | 🟡 medio |
| Metadata title puede seguir diciendo "code-first software company" vs hero "Technology development company". | layout/metadata | 🟡 medio |

---

## 2. Lo que puede mejorarse (existe pero se puede elevar)

| Área | Estado actual | Mejora |
|---|---|---|
| **Jerarquía tipográfica** | Heroes topan ~34px (`clamp ... 2.15rem`). En Home el chat-card pesa más que el mensaje. | Subir escala de display de hero (Vercel usa heading-56/64/72). Mensaje primero, herramienta segundo. |
| **Sistema tipográfico** | Escala existe en `globals.css` pero la capa V0 + template-detail H1 la ignoran (sans `font-semibold` vs serif `.site-*-title`). | Forzar todos los headings al sistema (`.site-section-title` etc.) o documentar override sans explícito. |
| **Color** | `#1200c5` coherente en superficie porteada y tokenizado. V0 abandona el token system por Tailwind raw multicolor. | Rutear TODO color de V0 por `siteTones`/`siteStatusTones`/`siteChromeDots` (los tokens ya existen, se ignoran). |
| **Motion** | framer-motion instalado, pero hay **3 mecanismos de reveal incompatibles** (`useRevealOnView`, framer `useInView`, CSS inline `animation`). Primitivas nuevas (`StaggeredReveal`, `AnimatedCounter`) sin adoptar. | Estandarizar UN primitivo de reveal. Adoptar las primitivas o borrarlas. |
| **Services cards** | Editorial, alternadas, buen ritmo — la mejor sección. | Conectarlas como decision-map (paths Build/Improvement); usar el `tone` per-servicio; ilustraciones a opacidad mayor que muestren *el output* (portal, audit report). |
| **ScrollLitStatement** | Word-by-word reveal on-brand y bien ejecutado. | Throttle con rAF (hoy muta cada span en cada evento scroll sin throttle); fallback `prefers-reduced-motion` (hoy queda en opacity 0.18 si JS falla). |
| **Contact form** | Genuinamente sólido, accesible, production-grade (honeypot, timing, aria-live, Zod). **Sección modelo.** | Mantener intacto. Es el patrón que las demás secciones deberían imitar. |
| **Operating model vs Boundaries** (/about) | Credibilidad-sin-métricas-falsas, exactamente lo que pide la marca. **Sección modelo.** | Subirla en la jerarquía (hoy está 5 secciones abajo, debajo de los terminales falsos). |
| **Tech stack band** | 10 isotipos mono limpios. | Alinear al stack aprobado (hoy muestra Cursor/Anthropic/AWS/GitHub; faltan Postgres/Stripe/Flutter/Python que sí están aprobados). |

---

## 3. Patrones detectados en Vercel

### Estructura y composición
- **PS-1 — Hero de 2 CTAs + un visual con proof embebido.** Headline declarativo corto + subhead + primary sólido + secondary ghost. El visual del hero carga un proof point (build 7m→40s). *Adaptable: direct.*
- **PS-2 — Enterprise lidera con logo wall ANTES del pitch.** Para comprador de alta consideración, credibilidad precede al pitch. *Adaptable: with_adjustment (Noon tiene pocos logos marquee → usar outcomes/case studies).*
- **PS-4 — Revelado progresivo en bandas split alternadas (izq/der).** Cada capability tiene su "momento". *Adaptable: direct — el ritmo editorial core. Impact: transformational.*
- **PS-6 — Ritmo de credibilidad intercalado** (quote→logos→stat repetido), no un bloque único de testimonios. Cada claim al lado del feature que valida. *Adaptable: direct.*
- **PS-7 — Banda CTA de cierre repetida** al final de cada página. *Adaptable: direct.*
- **PS-10 — Separación de secciones por cambio de fondo** (blanco↔casi-negro) + whitespace, casi sin divisores. El "Apple-clean calm". *Adaptable: direct.*

### Sistema visual
- **VS-1 — Sistema tipográfico nombrado y bloqueado** (Geist: heading-72/64/.../14, copy-24/.../13, label, button — cada clase con size+line-height+tracking+weight horneados). *Adaptable: with_adjustment — robar el SISTEMA, no la fuente (Noon usa Instrument Sans).*
- **VS-2 — Rampa neutra de 11 pasos + UN accent.** Color es un evento, no un wash. *Adaptable: direct — exactamente el modelo de Noon (#1200c5 raro sobre #000/#fff/gris). Impact: transformational.*
- **VS-3 — Escala de spacing base-8.** Bandas de ~60-128px. *Adaptable: direct.*
- **VS-4 — Radios chicos + hairline borders + casi cero shadow.** La elevación viene de borders + contraste de fondo, no drop shadows. Esto es lo que lee "técnico/preciso". *Adaptable: direct — valida la dirección square de Noon.*
- **VS-6 — Motion controlado y explicativo, nunca decorativo.** Animación solo para cosas que *significan* algo. *Adaptable: direct — ES la filosofía declarada de Noon.*
- **VS-9 — Kit de primitivas flat** (cards flat, 2 botones: solid accent + ghost; un badge). La repetición de pocas primitivas hace que todo se sienta un sistema. *Adaptable: direct.*
- **VS-10 — Stat block** (numeral enorme + label chico). *Adaptable: direct, con métricas reales.*

### Motion (tokens verbatim del CSS de producción de Vercel)
- **Duraciones:** 150ms default, 200ms para transforms, nunca más para hover/state.
- **Easings:** `cubic-bezier(.32,.72,0,1)` (spatial), `cubic-bezier(.4,0,.2,1)` (color).
- **Reveal:** `fade-in` + `slide-in` (translateY 75%→0, la distancia escala con el elemento). Stagger ≤80ms.
- **Reduced-motion (lo más importante):** Vercel nunca solo acorta — fija el end-state (`opacity:1`), pausa loops (`animation-play-state:paused`), y los typewriters tienen fallback estático (`display:none` + static). **Este es el baseline accesible que Noon debe copiar.**
- **Diagramas de sistema/flujo** (path-draw `stroke-dashoffset`/`pathLength`, token-along-pipeline `offsetPath`, node-highlight secuencial). **La categoría de mayor apalancamiento y más on-brand para Noon.** Impact: transformational.

### Trust / conversión
- **T1 — Logo wall con métrica** (no logos pelados). 3 logos curados + outcome cada uno. *with_adjustment — la métrica debe ser confirmada.*
- **T2 — Big-quote con atribución de rol.** Una quote fuerte > muro de quotes débiles. *direct.*
- **T5 — Sistema de CTA multi-nivel** (primary action / sales consultivo / contextual), repetido site-wide. *with_adjustment — el modelo estructural para Noon: Maxwell primary, Contact secondary, per-service/per-template contextual. Impact: transformational.*
- **T6 — "Talk to sales" como form real de baja fricción** (3 campos, segmentado por intent). *direct — ES el motion primario de Noon, no secundario.*
- **T8 — Tabs de filtro por industria** en el índice de social proof. Los business owners piensan en industrias, no frameworks. *direct — y reutilizable para los 3 tracks de /opportunities.*
- **S1-S6 — Template gallery + detail + customer story** (grid+filtro, hero screenshot + "View Demo" + stack badges + related, story 3-actos). *with_adjustment — filtrar por las 8 categorías de negocio, reemplazar "Deploy" por "Build something like this".*

---

## 4. Propuestas para Noon (priorizadas)

> Esfuerzo: S (<2h) · M (medio día) · L (1-2 días) · XL (varios días). Brand-fit: confianza de que encaja con la identidad.

### 🔴 P0 — Reconciliar la capa V0 (resuelve los críticos)

| # | Propuesta | Inspiración / razón | Archivos | Esf. | Brand-fit |
|---|---|---|---|---|---|
| 1 | **Eliminar TODAS las métricas fabricadas y frases prohibidas.** "3x Faster", "0% No-Code", "100% Human QA", "24h First Prototype", "in record time", "Full ownership of your code", "QA 98/100", "24/7", "100% Response Rate", "+49 pts/43 issues/4.2s→0.8s", nombres públicos "GPT-4/V0/Opus". | Documento Maestro §18.2 (frases prohibidas) + §3.3 (no claims inflados) | contact, about, /services pipeline, /upgrade, premium/* | M | alta |
| 2 | **Resolver los 3 SLAs contradictorios en /contact.** Hero "1-2 business days" vs ResponseTimeline "<2h/24h/48h" vs band "<2hrs/24/7/100%". Dejar SOLO "1-2 business days". | Honestidad de marca | contact/page.tsx, response-timeline.tsx | S | alta |
| 3 | **Reconstruir o retirar PipelineShowcase.** Dark-only (rompe en light), claims prohibidos, visualiza un AI-pipeline de developer (terminal bash, GPT-4/V0/Opus). Si se conserva el concepto → reconstruir theme-aware, sin nombres de modelos, framing "AI-accelerated, human-reviewed". | Brand: audiencia=business owners, no developers | pipeline/*, services/page.tsx | L | media |
| 4 | **Reconstruir o retirar ComparisonShowcase + ResponseTimeline.** Sistema visual ajeno (rounded-2xl, gradient glow, loops infinitos, traffic-light dots, rgb() crudos) + el grueso de las métricas falsas. | Brand: un solo sistema visual | premium/comparison-showcase.tsx, response-timeline.tsx | L | media |
| 5 | **Quitar mockups de producto/CLI falsos en /about.** `npx create-noon-app`, `maxwell.noon.dev`, "Maxwell Engine v2.6.0" inventan un dev-tool que no existe. | Brand: Noon es services firm, no npm package | about/page.tsx (PipelineTerminal, EngineDeploymentMockup) | M | alta |

### 🟠 P1 — Fundación del sistema (habilita todo lo demás)

| # | Propuesta | Inspiración | Archivos | Esf. | Brand-fit |
|---|---|---|---|---|---|
| 6 | **Arreglar el dark mode roto.** Decidir: (a) cablear clase `.dark` con toggle, o (b) eliminar todos los `dark:` utilities y depender solo de tokens. Hoy todo `dark:` es no-op. | VS-7 (parity dual-asset) | globals.css, componentes con `dark:` | M | alta |
| 7 | **Baseline global de `prefers-reduced-motion`** al estilo Vercel: end-state fijo + `animation-play-state:paused` para loops + fallback estático para typewriters. `MotionConfig reducedMotion="user"` en el provider de framer. | Motion foundation de Vercel | provider raíz, globals.css | M | alta |
| 8 | **Documentar + unificar el design system.** Un archivo de tokens: escala de color (rampa neutra + #1200c5), tipografía nombrada (Instrument Sans con tracking/lh horneados), spacing base-8, escala de radius de 3 pasos (prohibir `rounded-2xl`), containers. | VS-1/2/3/4 | nuevo `lib/design-tokens` + globals.css | L | alta |
| 9 | **Unificar motion en UN primitivo.** Estandarizar reveal (recomendado: framer `whileInView once` con tokens 150/200ms + easings de Vercel). Adoptar `StaggeredReveal` o borrarlo. Borrar `gradient-glow`/`floating-particles` (caen en "evitar"). | Motion foundation | hooks/, components/ui/, premium/* | L | alta |
| 10 | **Rutear todo color de V0 por tokens** (`siteTones`/`siteStatusTones`/`siteChromeDots`). | VS-2 | premium/*, before-after-scan, template-hero-preview | M | alta |

### 🟡 P2 — Patrones de Vercel que elevan (alto valor, on-brand)

| # | Propuesta | Inspiración | Esf. | Brand-fit |
|---|---|---|---|---|
| 11 | **Librería de diagramas de sistema/flujo animados** (path-draw, token-along-pipeline, node-highlight). LA categoría más on-brand y de mayor apalancamiento. Empezar por visualizar el decision-map de Services (Build path / Improvement path). | VS-6 + diagramas Vercel | L | alta |
| 12 | **Services como decision-map real** (no stack). Visualizar Custom Dev→Eng Support y Audit→Upgrade con conectores (sin diagonales/caos, fallback accesible). | Brand §5.1 + PS-4 | M | alta |
| 13 | **Sistema de CTA multi-nivel repetido** (Maxwell primary / Contact secondary / contextual per-service y per-template), banda de cierre en cada página apuntando a destinos correctos (no Home). | T5/T6/PS-7 | M | alta |
| 14 | **Página /customers (case studies)** con story 3-actos (challenge→solution→results), quote con rol real, outcomes cualitativos cuando no haya números firmados, filtro por industria. | S4/T2/T8/PS-2 | XL | alta |
| 15 | **Rehacer /templates** — grid + filtro por las **8 categorías de negocio** (no facets de developer); cada card → detail real; landing por categoría. | S1/S5 | L | alta |
| 16 | **Rehacer /templates/[slug]** — hero screenshot + "View Demo" real + stack badges (solo stack aprobado) + "Build something like this"→Maxwell (no "Deploy") + related. | S3 | M | alta |
| 17 | **Rehacer /opportunities con 3 tracks** (Sellers/Developers/Investors+Next-product) como tabs estilo Vercel, cada uno con CTA y form segmentado; pre-rutear inquiry. | T8/brand | M | alta |
| 18 | **Sección de credibilidad intercalada** (quote+logo+stat al lado de cada feature) en vez de bloques aislados. Solo métricas confirmadas o framings cualitativos. | PS-6/VS-10 | M | media |
| 19 | **Trust como prácticas, no badges.** "Human code review", "Dependency scanning", "Encryption by default", "Security review before production" — lo que Noon SÍ hace. NO SOC2/ISO badges que no posee. | T4 reframe | S | alta |
| 20 | **Ritmo editorial: bandas split alternadas + separación por fondo** (#fff↔#000) en las páginas largas. | PS-4/PS-10 | M | alta |

### 🟢 P3 — Pulido y fixes puntuales

| # | Propuesta | Esf. |
|---|---|---|
| 21 | Arreglar los 3 CTAs finales → Contact/Maxwell (no Home). | S |
| 22 | Arreglar locale-loss en "Ask Maxwell" + `max-h-48` clip en FAQ + i18n del FAQ. | S |
| 23 | Reemplazar social links placeholder por reales (set TikTok/FB/IG de marca). | S |
| 24 | i18n en /opportunities, /upgrade, filtros de /templates. | M |
| 25 | Alinear tech-stack band al stack aprobado. | S |
| 26 | Alinear metadata title con "Technology development company". | S |
| 27 | Usar el `tone` per-servicio en /services (diferenciación visual). | S |
| 28 | Throttle (rAF) + reduced-motion fallback en ScrollLitStatement. | S |
| 29 | Footer tagline → copy aprobado de marca. | S |
| 30 | Purgar dead CSS (`bg-gradient-radial`, `.liquid-glass-nav` o usarlo, `.glow-*` olive). | S |
| 31 | Inbox institucional (no gmail) si hay decisión. | S |
| 32 | Confirmar ruta Maxwell pública `/maxwell` vs `/maxwell/studio` gated. | S |
| 33 | Fix `--destructive-foreground` light mode. | S |
| 34 | a11y: `aria-expanded`/focus-trap/Escape en mobile nav; `aria-pressed` en filtros; focus rings consistentes. | M |
| 35 | Pase real a 320px en /upgrade + before-after-scan (filas no-wrap que desbordan). | M |

---

## 5. Impacto esperado

| Propuesta | Calidad visual | Conversión | Diferenciación marca | Deuda técnica |
|---|---|---|---|---|
| P0 (1-5) eliminar V0 off-brand | ▲▲▲ | ▲▲ | ▲▲▲ (deja de leerse como dev-platform genérico) | ▼▼▼ (elimina 2 design systems) |
| #6 dark mode | ▲▲ | — | ▲ | ▼▼ |
| #7 reduced-motion | ▲ (a11y) | ▲ | ▲▲ (motion controlado = marca) | ▼ |
| #8 design system doc | ▲▲ | — | ▲▲ | ▼▼▼ |
| #11 diagramas de sistema | ▲▲▲ | ▲▲ | ▲▲▲ (LA cosa que Noon hace y Vercel valida) | — |
| #12 Services decision-map | ▲▲ | ▲▲▲ (claridad de decisión = más leads calificados) | ▲▲▲ | — |
| #13 CTA multi-nivel | ▲ | ▲▲▲ | ▲ | ▼ |
| #14 /customers | ▲▲ | ▲▲▲ (proof = trust en compra de alta consideración) | ▲▲▲ | — |
| #15-16 templates | ▲▲ | ▲▲ | ▲▲ | ▼ |
| #17 opportunities | ▲ | ▲▲ | ▲▲ (cumple spec de marca) | ▼ |

---

## 6. Prioridades (roadmap secuenciado)

**P0 — Hacer primero (estabilizar marca + light mode):**
Propuestas 1-5. Sin esto, el sitio en light mode tiene secciones rotas y claims que violan la marca. Es la deuda más urgente. *Decisión requerida de Mel: ¿reconstruir o retirar las secciones V0?*

**P1 — Siguiente (fundación del sistema):**
6 (dark mode), 7 (reduced-motion), 8 (design tokens doc), 9 (motion unificado), 10 (color por tokens). Habilita ejecución consistente de todo lo demás.

**P2 — Después (capitalizar Vercel, on-brand):**
11 (diagramas — empezar acá, es lo más diferenciador), 12 (Services decision-map), 13 (CTA system), luego 15-17 (templates/opportunities) y 14 (/customers) según prioridad comercial.

**P3 — Continuo (pulido):**
21-35, intercalados. Los fixes S de 1 línea se pueden agrupar en un PR de "polish".

---

## 7. Recursos recomendados

| Recurso | Para qué | Veredicto |
|---|---|---|
| **framer-motion@12** (ya instalado) | Reveals, diagramas, microinteracciones. | ✅ Usar — pero con `MotionConfig reducedMotion="user"` y tokens de duración/easing de Vercel. |
| **Radix UI** (probable que ya esté vía shadcn) | Accordion (FAQ), tabs (opportunities/industries), menús. Vercel lo usa. | ✅ Adoptar para accordion/tabs accesibles. |
| **lucide-react** (ya instalado) | Iconografía mono line. | ✅ Mantener — coherente con VS-8. |
| **SVG path-draw nativo** (`pathLength` de framer / `stroke-dashoffset`) | Diagramas de sistema/flujo. | ✅ No requiere librería nueva. |
| **next/font** (ya en uso) | Instrument Sans variable. | ✅ Mantener. |
| Librería de gráficos pesada (recharts/visx) | — | ❌ No necesario — los "charts" de Noon deben ser diagramas explicativos, no dashboards de datos. |
| Custom cursor / WebGL / Three.js | — | ❌ Evitar — Vercel mismo no lo usa en marketing; viola "no decoración futurista". |
| **`gradient-glow` / `floating-particles`** (V0, ya en repo) | — | ⚠️ Revisar/eliminar — caen en el bucket "evitar" de la marca. |

---

## 8. Lo que NO hacer (diluiría la identidad de Noon)

Patrones de Vercel que son **PaaS-específicos** y harían que Noon se lea como dev-platform:

1. **Code snippets / terminal UI / texto mono-pesado** — el tell #1 de "developer platform". Mostrar *lo que se entrega*, no source code. Mono fuera del copy de marketing.
2. **Grids de frameworks/SDKs** — los frameworks son stack interno, no el pitch público. Solo isotipos restringidos (ya es patrón de Noon).
3. **Métricas de infraestructura** ("125+ PoPs", build-time-in-seconds, latencia) — venden un PaaS.
4. **Pricing por asientos** (Hobby/Pro/Enterprise) — Noon es project-scoped custom dev. Traducir solo a un decision-map de servicios + "what's included" honesto.
5. **CTAs self-serve "Deploy / Start Deploying"** — implican producto instantáneo. El primary de Noon es scoping/consultoría (Maxwell, audit, contact).
6. **Grids animados pesados / fondos orbitales futuristas a full-page** — cap a UN diagrama explicativo contenido o UN radial #1200c5 tenue.
7. **Métricas fabricadas** (la violación #1 de marca) — solo números confirmados por cliente.
8. **Badges SOC2/ISO/PCI/HIPAA que Noon no posee** — sus clientes' plataformas los tienen, no Noon. Reframe a prácticas reales de ingeniería.
9. **Marquees / logo carousels infinitos** — decoración sin propósito. Logo row estático = alternativa on-brand.
10. **Typewriter en headlines de marketing** — solo dentro de un demo real de producto/código que explique el flujo.

---

## 9. Cosas NO cubiertas en este audit (necesitan pase aparte)

- **Mobile a fondo** — solo se detectaron riesgos de overflow a 320px en /upgrade + before-after-scan; falta pase dedicado responsive en todas las páginas.
- **Accesibilidad profunda** — se detectaron gaps (reduced-motion, focus-trap, aria-expanded, color-only state) pero falta auditoría WCAG completa + screen reader testing.
- **Performance** — LCP del watermark ya flagueado; falta Lighthouse/Core Web Vitals, bundle size (framer-motion + V0 components agregaron peso).
- **SEO / metadata / Open Graph** — title inconsistente flagueado; falta auditar OG cards, sitemap, robots, structured data.
- **i18n más allá de traducción** — formatos de fecha/moneda, fallbacks de locale, RTL (si aplica a expansión).
- **Empty states / 404 / error pages** — no auditadas.
- **Analytics consistency** — la Cookies Policy dice que NO usa analytics; verificar si Vercel Analytics está activo (inconsistencia legal flagueada en Documento Maestro §16.3).
- **Emails transaccionales** — touch points de Maxwell/propuestas no auditados (fuera de scope website).

---

*Reporte generado por 6 agentes (4 audit Noon + 2 research Vercel, con un 3er research de motion) + síntesis. Contexto de marca: `specs/_audit-brand-context.md` + Documento Maestro 2026. Todos los hallazgos verificados contra archivos reales del repo y páginas live de vercel.com.*
