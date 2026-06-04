# Noon — Brand context para el audit (destilado del Documento Maestro 2026)

> Fuente: `Noon_Documento_Maestro_2026.pdf` (Master 2026-05-05) + memoria del proyecto.
> Este archivo es scaffolding del audit 2026-06-01. Source-of-truth operativo.

## Qué es Noon
**Technology development company** que convierte necesidades de negocio ambiguas en
software real, escalable, construido en código y acelerado por IA. NO es agencia genérica,
NO es marketplace de freelancers, NO es no-code/low-code, NO vende "MVPs rápidos".

Definición canónica: *"Noon is a technology development company that turns unclear software
needs into scoped, production-ready systems built in real code and accelerated by AI."*

## Posicionamiento y anti-posicionamiento
- **Audiencia**: dueños de negocio / operadores con una necesidad real de software. NO developers.
- **Diferenciadores**: Real delivery · Scope before execution · AI-accelerated (no AI-replaced) ·
  Code-built systems · Human review · Operational ecosystem.
- **NO insinuar**: agencia de marketing/branding, no-code, marketplace genérico, prototipos=producto,
  escala/tiempos inflados, Maxwell reemplaza criterio humano.

## Paleta vigente
- Primary / Accent: `#1200c5`  (reemplaza el viejo #3B2EB9)
- Background oscuro: `#000000`
- Background claro: `#FFFFFF`

## Dirección visual (CRÍTICO para el audit)
- Minimalista editorial, técnica y premium.
- **Inspiración Apple**: limpieza, espacio, jerarquía, sofisticación.
- **Inspiración Vercel**: representación técnica, interfaces, sistemas y MOTION CONTROLADO.
- Fondos limpios, tipografía con presencia, sombras sutiles, composición sobria.
- **Motion solo cuando ayude a explicar un sistema, relación, flujo o producto.**
- NO saturar con efectos, gradientes, visuales futuristas o decoración sin propósito.
- La marca debe sentirse precisa, seria, moderna y confiable.

## Tono editorial
- Claro, directo, técnico sin ser frío en exceso. No venta agresiva.
- Evitar: "revolucionario", "ilimitado", "garantizado", "el mejor".
- Lenguaje de decisión: scope, delivery, activation, workspace, ownership, codebase, AI-assisted.

## Oferta pública: 4 servicios
1. **Custom Development** — nuevo software alrededor de lógica de negocio.
2. **Upgrade** — mejorar un sistema/website existente que rinde mal.
3. **Engineering Support** — capacidad técnica sin montar departamento interno.
4. **Business Technology Audit** — diagnóstico antes de invertir en desarrollo.

Relaciones (NO conectar todos con todos):
- Build path: Custom Development → After launch → Engineering Support.
- Improvement path: Business Technology Audit → Findings → Upgrade.
- Services debe sentirse **decision map**, NO grid genérico.

## Páginas públicas
Home · Services · Upgrade · About · Contact · Templates · Template detail ·
Work with Noon / Opportunities · Next product by Noon · Legal.

- **Home y Upgrade**: pueden estar CONGELADOS según brief; no tocar fuera de alcance.
- **Templates**: categorías aprobadas = SaaS, Dashboards, Internal tools, AI assistants,
  Marketplaces, Booking platforms, E-commerce, Mobile apps. Cada card → detalle real.
- **Opportunities**: separar Sellers, Developers, Investors / Next product interest.

## Maxwell
Capa conversacional de scoping. Ruta aprobada: `/maxwell`. Input del hero abre Maxwell y
preserva el prompt. NO es workspace. Pre-pago separado del workspace post-pago.

## Footer y social
- Brand copy: "Noon — Custom software built in real code. From idea to production-ready
  applications, powered by AI."
- Socials: TikTok, Facebook, Instagram. **Remover X** si no hay uso oficial.
- **No mostrar email en footer** (Contact es la ruta institucional).
- **Remover "All systems operational"** si aparece por arrastre.

## Stack visible aprobado
Next.js · React · TypeScript · Tailwind · Node.js · Python · PostgreSQL · OpenAI ·
Vercel · Supabase · Stripe · Flutter. Mantener foco, no listado infinito.

## Mensajes aprobados (copy fuerte)
- "Technology development company."
- "Tell us what you want to build."
- "A technology development company built around real delivery."
- "Scope before execution." · "Working software, not documentation." ·
  "Judgment, not blind execution." · "Ownership aligned with your engagement model."

## Frases PROHIBIDAS
"Full ownership always" · "Your code, your repo" · "Temporary intake flow" ·
"MVP rápido" como promesa · "No-code/drag-and-drop" como base · promesas absolutas.

## Reglas UX duras
- No flechas diagonales ni redes visuales caóticas.
- Conectores/arrows deben explicar relaciones reales + fallback accesible legible.
- Contact institucional, formulario real, email visible, sin teléfono público.
- Respuesta pública: 1–2 business days.

## Pendientes conocidos (relevantes al website)
- Metadata/title todavía dice "The code-first software company" mientras el hero usa
  "Technology development company" → alinear.
- Confirmar analytics (Cookies Policy dice que NO usa analytics; si hay Vercel Analytics, inconsistencia).
- Definir templates reales + páginas de detalle.
- Definir Opportunities (Sellers/Developers/Investors) e Investor/Next-product interest form.

## Contexto técnico actual del repo (web-main)
- Next.js 16.2.6 + Turbopack, React 19, Tailwind v4 (`@theme inline`), next-intl (en/es/fr/de).
- 4 páginas porteadas del Figma con `figma-canon` (Instrument Sans): services, about, opportunities, contact.
- V0 agregó (PR #33, mergeado): framer-motion@12.40.0, PipelineShowcase, premium/* (comparison,
  before-after-scan, response-timeline, template-hero-preview), industries-section, process-timeline,
  stats-counter-section, animated-counter, floating-particles, gradient-glow, staggered-reveal.
- Estética actual: square (0px radius en marcos exteriores, 8px en inputs internos), azul #1200c5
  al 65% alpha en bordes de botones, tech stack como 10 isotipos simple-icons.
- Auth: navbar muestra UserMenu cuando hay viewer, sino "Sign up".
