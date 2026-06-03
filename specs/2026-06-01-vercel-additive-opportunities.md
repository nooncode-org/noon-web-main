# Noon × Vercel — Oportunidades aditivas (qué AÑADIR para mejorar)

**Fecha:** 2026-06-01
**Alcance:** Análisis comparativo de *experiencia* Noon vs Vercel, orientado a **qué incorporar** (secciones, patrones, motion, microinteracciones, mockups, narrativa, jerarquía, UX). Complementa — no repite — el audit de limpieza `2026-06-01-noon-vs-vercel-audit.md` (ese cubre bugs y deuda off-brand).
**Regla rectora:** Noon es una **firma de desarrollo para dueños de negocio**, no una dev-platform. Robamos el *sistema* de Vercel (rigor, motion explicativo, proof intercalado), no su *piel* de PaaS (terminales, frameworks, métricas de infra).

---

## 0. Estado actual (para anclar el análisis)

**Ya reconstruido al canon desde el último audit:**
- `PipelineShowcase` (/services) — flujo need→scope→build→deliver, theme-aware, mockups con motion contextual real, scroll interno visible.
- `ComparisonShowcase` (/about) — before/after con estado "resolving…".
- `ResponseTimeline` (/contact) — grid bordeado estilo Vercel, números mono, sin métricas falsas.
- Sistema de radios **0px (marcos) / 8px (interiores)**; scrollbar fina visible en mockups; editor de código theme-aware.

**Pendiente off-brand que BLOQUEA "añadir" (limpiar primero):**
- `/about` → `PipelineTerminal` (`npx create-noon-app`) + `EngineDeploymentMockup` ("Maxwell Engine v2.6.0", logs) → inventan un dev-tool que no existe.
- `Home` → `FloatingTechElements` (snippets de código + binario flotando en loop infinito) → decoración "developer", justo lo que la marca prohíbe.
- `/contact` → "Stats Band" (3 columnas) → revisar métricas posibles fabricadas.
- `/templates` → `BeforeAfterScan` (+49 pts / 4.2s→0.8s) + filtros por categorías de developer (framework/CSS/db).
- `dark:` de Tailwind muerto (solo media-query OS).

> No tiene sentido añadir capas premium sobre secciones que aún leen como "dev-platform genérica". El orden correcto es: **limpiar P0 → fundación → añadir.**

---

## 1. La diferencia de experiencia, por dimensión

| Dimensión | Vercel | Noon hoy | El gap / oportunidad |
|---|---|---|---|
| **Narrativa** | "Results before features": hero → proof → use-cases → product blocks → CTA repetido. Arco claro. | Heroes sólidos por página, pero **sin arco** ni proof. Home = solo el chat. | Falta una **columna vertebral narrativa** y, sobre todo, **prueba social**. |
| **Estructura** | Template de página consistente (hero abstracto → proof → diagrama → grid → CTA). | Cada página es su propia isla; orden ad-hoc. | **Ritmo editorial repetible** (bandas alternadas + cierre CTA). |
| **Jerarquía** | Eyebrow → headline declarativo corto → visual que *prueba* el claim al lado. | Headlines ok, pero el visual rara vez "prueba" algo; copy y visual no dialogan. | **Emparejar cada claim con un visual concreto** (mockup/diagrama/stat). |
| **Microinteracciones** | Hover sube contraste, nav con pill que sigue cursor, CTA con flecha que avanza, focus-visible en todo. | Hover básico; pocas microconfirmaciones. | **Kit de microinteracciones** sutil y consistente. |
| **Motion** | Solo cuando aclara causa-efecto. Diagramas de sistema (path-draw, token-along). Reduced-motion impecable. | Reveals on-scroll (3 mecanismos distintos), motion contextual en el pipeline. | **Unificar motion + librería de diagramas de sistema** (lo más on-brand). |
| **Proof / trust** | Logo+stat intercalado, big-quote con rol, ROI blocks, tabla comparativa. | Casi nulo. Sin customers, sin quotes, sin outcomes. | **La oportunidad #1**: capa de credibilidad real. |
| **Mockups** | Screenshotean el producto real (dashboards, telemetría) lightly idealizado. | Mockups de *dev-tool falso* (terminal, engine) en /about. | **Mostrar el DELIVERABLE** (portal/dashboard del cliente), no source code. |
| **Conversión** | CTA multinivel (deploy / get a demo / contextual) repetido. Forms de baja fricción embebidos. | CTAs finales apuntan a Home (bug); form de contacto excelente pero aislado. | **Sistema CTA multinivel** (Maxwell / Contact / contextual). |

---

## 2. Oportunidades concretas por dimensión

> Esf.: S (<2h) · M (medio día) · L (1-2 d) · XL (varios d). Brand-fit = confianza de que encaja sin diluir la identidad.

### A. Narrativa & estructura
| # | Oportunidad | Inspiración Vercel | Traducción Noon | Esf. | Fit |
|---|---|---|---|---|---|
| A1 | **Arco narrativo cross-site**: cada página larga sigue hero → 1 proof → capability bands alternadas → cierre CTA correcto. | Template de página consistente | Estandarizar el orden con las secciones que ya tenemos. | M | alta |
| A2 | **Persona self-select** (¿para quién es esto?). | Use-case tabs del home | Reusar `IndustriesSection` (ya existe, sin usar) como tabs "A quién ayudamos" (industrias, no frameworks). | M | alta |
| A3 | **Home below-the-fold** (si se descongela el brief): qué es Noon + 4 servicios + 1 proof + CTA, debajo del chat. | Hero corto + bloques | Decisión de Mel: el home hoy es solo el chat. | L | media\* |

### B. Secciones nuevas
| # | Oportunidad | Inspiración | Traducción Noon | Esf. | Fit |
|---|---|---|---|---|---|
| B1 | **/customers (case studies)** — la pieza que más falta. | Enterprise logo+ROI, big-quote | Historia 3 actos (reto→solución→resultado), outcomes **cualitativos** si no hay números firmados, filtro por industria. | XL | alta |
| B2 | **Banda de credibilidad intercalada** (quote/outcome al lado de cada capability), no un bloque aislado. | Ritmo de proof | Solo métricas confirmadas o framings cualitativos ("redujo el trabajo manual del equipo de soporte"). | M | alta |
| B3 | **Services como decision-map** (Build path: Custom Dev→Eng Support / Improvement path: Audit→Upgrade) con conectores. | Diagramas/comparativas | Diagrama animado on-brand (ver D2). | M | alta |
| B4 | **Tabla comparativa honesta** "Cómo trabajamos vs. el camino tradicional" o "qué incluye cada servicio". | Tabla /fluid | Sin inventar; columnas = nuestras prácticas reales. | M | alta |

### C. Patrones visuales (kit reutilizable)
| # | Oportunidad | Inspiración | Traducción Noon | Esf. | Fit |
|---|---|---|---|---|---|
| C1 | **Grid bordeado hairline** como unidad de contenido dominante (ya lo usamos en ResponseTimeline → extender). | Bordered feature grids | Estandarizar el patrón celda = marcador 8px + título + 1 línea. | S | alta |
| C2 | **Stat block** numeral grande + label, con `tabular-nums`. | Stat blocks | Solo con números reales/confirmados. `StatsCounterSection` ya existe (sin usar). | S | alta |
| C3 | **Eyebrow de 2 partes** (categoría + microdescripción) sobre headlines de sección. | Eyebrows /enterprise | Sustituir/elevar los pills actuales en secciones clave. | S | alta |
| C4 | **Separación de secciones por cambio de fondo** (#fff↔#000) + whitespace, casi sin divisores. | "Apple-clean calm" | Aplicar a /services y /about (páginas largas). | M | alta |

### D. Motion & microinteracciones
| # | Oportunidad | Inspiración | Traducción Noon | Esf. | Fit |
|---|---|---|---|---|---|
| D1 | **Baseline reduced-motion global** (`MotionConfig reducedMotion="user"` + end-state fijo + pausa de loops). | Web Interface Guidelines | Fundación; habilita todo lo demás con accesibilidad. | M | alta |
| D2 | **Librería de diagramas de sistema** (path-draw `pathLength`, token-along-pipeline, node-highlight secuencial). **La categoría más diferenciadora.** | /ai orbit, /fluid, diagramas | Empezar por el decision-map de Services y el flujo del pipeline. SVG nativo, sin librería nueva. | L | alta |
| D3 | **Kit de microinteracciones**: hover sube contraste, flecha de CTA avanza, card lift sutil, button press, `:focus-visible` en todo. | Microconfirmaciones | Tokens 150/200ms + easing `cubic-bezier(.32,.72,0,1)` (ya los usamos). | M | alta |
| D4 | **Unificar a UN primitivo de reveal** (hoy hay 3). | Motion coherente | `whileInView once` + tokens. | M | alta |
| D5 | **Number counters** on-view para stats reales. | Stat animation | `StatsCounterSection` existente. | S | media |

### E. Mockups & gráficos
| # | Oportunidad | Inspiración | Traducción Noon | Esf. | Fit |
|---|---|---|---|---|---|
| E1 | **Reemplazar mockups dev-falsos por mockups de DELIVERABLE** (portal de cliente, dashboard de negocio, panel de admin) — como el "orders dashboard" del pipeline. | "El producto es el héroe" (/observability) | Mostrar *lo que recibe el cliente*, no código. Datos plausibles, **sin** claims de performance. | M | alta |
| E2 | **Galería "qué entregamos"** (tipos de software: portales, herramientas internas, dashboards) como mini-mockups. | Product showcase blocks | Concreto y legible para un dueño de negocio. | L | alta |
| E3 | **Diagrama de ecosistema/integración** ("tu stack, integrado") con cuidado de no leer como PaaS. | /ai orbit | Solo si refuerza "conectamos tu operación", con isotipos restringidos. | M | media |

### F. Jerarquía & contenido
| # | Oportunidad | Inspiración | Traducción Noon | Esf. | Fit |
|---|---|---|---|---|---|
| F1 | **Sistema tipográfico nombrado y bloqueado** (escala display 56/64, copy, label — con tracking/lh horneados en Instrument Sans). | Geist type scale | Documentar + forzar; subir escala de hero. | L | alta |
| F2 | **Headline declarativo + visual que lo prueba** al lado (reframe/outcome, no nombre de feature). | Copy↔visual pairing | Reescribir headlines de sección a claims con proof adyacente. | M | alta |
| F3 | **Mono solo para "verdad técnica"** (labels, tiempos, código en mockups), nunca en headlines de marketing. | Geist Mono reservado | Ya lo aplicamos en pipeline/timeline → mantener disciplina. | S | alta |

### G. UX & conversión
| # | Oportunidad | Inspiración | Traducción Noon | Esf. | Fit |
|---|---|---|---|---|---|
| G1 | **Sistema CTA multinivel** repetido: Maxwell (primary) / Contact (secondary) / contextual per-servicio y per-template. | CTA multinivel | Arreglar de paso los 3 CTAs que van a Home. | M | alta |
| G2 | **Forms de baja fricción embebidos** cerca del punto de decisión (no solo en /contact). | "Talk to sales" inline | Reusar el form de intake (ya es production-grade). | M | alta |
| G3 | **/templates por categorías de negocio** + "Build something like this"→Maxwell (no "Deploy"). | Template gallery | Reemplazar facets de developer. | L | alta |
| G4 | **/opportunities con 3 tracks reales** (Sellers/Developers/Investors+Next-product) como tabs + pre-rutear inquiry. | Use-case tabs | Cumple además spec de marca. | M | alta |

\* A3 sujeto a decisión sobre el freeze del Home.

---

## 3. Por dónde empezar (top 5, mayor apalancamiento × on-brand)

1. **Limpiar P0** (mockups dev-falsos de /about, floating-code del Home, stats band de /contact). *Sin esto, lo demás se construye sobre arena.*
2. **D2 — Diagramas de sistema animados** (empezar por el decision-map de Services). Es lo que Noon *hace* y lo que más nos diferencia; Vercel lo valida.
3. **B1/B2 — Capa de credibilidad** (case studies + proof intercalado). El gap de mayor impacto en conversión para compra de alta consideración.
4. **E1 — Mockups de deliverable** (portal/dashboard del cliente) en lugar de código.
5. **D1 + D3 + D4 — Fundación de motion** (reduced-motion, microinteracciones, un solo reveal). Hace que todo se sienta "un sistema".

---

## 4. Guardarraíles — qué NO traer de Vercel (diluiría a Noon)
Terminal/CLI/código como tema · grids de frameworks/SDKs · métricas de infra (PoPs, build-time, latencia) · pricing por asientos · CTAs self-serve "Deploy" · fondos orbitales/WebGL full-page · **métricas fabricadas** · badges SOC2/ISO que no poseemos · marquees infinitos · typewriter en headlines. (Detalle en el audit previo, §8.)

---

## 5. Material que afinaría el análisis
- **Capturas** de las secciones de Vercel que querríamos emular con precisión: el **mega-menú morphing**, las **comparativas animadas de /fluid**, el **dashboard de /observability**, y el **orbit de /ai** (la investigación tuvo confianza media en el motion exacto).
- **Confirmación del freeze del Home** (¿podemos añadir narrativa below-the-fold?).
- **Qué outcomes/clientes reales** podemos citar (aunque sea cualitativo) — define si B1/B2 son viables ya o placeholder.
- **Stack aprobado definitivo** para la banda de tecnología y los badges de templates.
