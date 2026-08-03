# Catálogo anti-slop — los tells de UI generada por IA (2026-08-02)

> Investigación encargada por el owner ("NO AI SLOP… como el típico tag en cada
> título, investiga bien para que los tengamos identificados"). Consolidado de
> los catálogos de la comunidad — el de **Impeccable** (61 patrones,
> impeccable.style/slop) y el de Developers Digest (16 patrones) más las guías
> de 2026 — deduplicado y ordenado por severidad.
>
> **Definición operativa de slop** (la que gobierna el sistema): slop es lo que
> aparece cuando el ejecutor tuvo que decidir algo que el orquestador no
> especificó. No es "hecho por IA" — es "hecho por IA sin que nadie eligiera".
>
> **Uso previsto** (pendiente del cierre de definiciones del Quality Layer):
> (1) léxico de la rúbrica del juez visual; (2) lista prohibida del copy que
> escribe el orquestador; (3) reglas negativas del system prompt de v0.

## Nivel S — los inequívocos (uno solo ya delata)

| # | Tell | Descripción |
|---|---|---|
| S1 | **Badge/pill sobre el H1** | La pastillita ("✨ New", "AI-powered") justo encima del titular del hero. El tell del owner. |
| S2 | **Kicker/eyebrow en CADA sección** | Micro-etiqueta uppercase con tracking sobre cada título. (Ya vetado en el sitio de Noon: feedback-no-kicker-tags.) |
| S3 | **Borde de color lateral en cards** | Franja de 3-4px morada/azul en el borde izquierdo o superior de cards/quotes — "tan fiable como los em-dashes". |
| S4 | **Paleta IA: morado/violeta + cian sobre oscuro** | El "VibeCode purple", gradientes morado→azul en hero/CTA/fondos. |
| S5 | **Dark mode permanente con glows de color** | Fondo oscuro + box-shadows de color brillando + texto gris medio que suspende AA. |
| S6 | **Inter / Space Grotesk / Instrument Serif por reflejo** | Las fuentes default de todas las herramientas; sola o "serif itálica para UNA palabra del hero". |
| S7 | **Hero centrado genérico + grid de cards idénticas icon-top** | La plantilla universal: hero centrado → 3×2 features con iconito arriba → stats → CTA. |
| S8 | **Emoji como iconografía** | Emojis en nav, features o titulares en lugar de un sistema de iconos. |
| S9 | **Buzzwords + em-dashes** | "Streamline / empower / unlock / enterprise-grade", métricas inventadas (10x, 99%), em-dashes en cadencia de IA. |

## Catálogo completo por categoría

### Detalle visual
- Grid decorativo de fondo sin función (no es canvas/mapa/medida)
- Glassmorphism decorativo (blur sin propósito)
- Hairline border + sombra ancha difusa (firma de UI generada)
- Rayas por repeating-gradient como decoración
- Border-radius extremo (24px+, cards amorfas)
- SVG "hand-drawn" amateur
- Glow radial de acento tras secciones / halo saturado en fondos oscuros
- Texto en gradiente (ilegible al escanear)
- Beige/crema elegido por reflejo (no por familia)

### Tipografía
- Jerarquía plana (tamaños demasiado próximos)
- Texto funcional <11px; body <12px; line-height <1.3
- Icon-tile (cuadradito redondeado con icono) apilado sobre el título
- Serif itálica gigante como titular principal
- Letter-spacing aplastado en display / tracking ancho (>0.05em) en body
- Una sola fuente para todo, sin jerarquía
- Body largo en ALL-CAPS
- Headline de frase completa a escala masiva dominando el viewport

### Layout y espacio
- Numeritos editoriales junto a títulos imitando estructura de revista
- Hero-metric layout: número grande + label chico + 3 stats + acento gradiente
- Stat banners uniformes en fila
- Secuencias "1, 2, 3" de pasos como muletilla
- Cards dentro de cards dentro de cards
- Espaciado monótono (un solo valor, sin ritmo)
- Grids de cards idénticas (icono+título+texto ×6)
- Líneas de texto >80 caracteres
- Contenido desbordando contenedores; tooltips/menús recortados por overflow
- Columna que estira más allá del viewport (espacio muerto)
- Títulos pegados al bloque anterior; texto pegado a los bordes

### Motion
- Status dot pulsante DECORATIVO (si no representa estado real, es slop)
- Cursor parpadeante falso en copy del hero
- Marquee auto-scroll
- Easing con rebote/elástico en dialogs y cards
- Animar width/height/padding (jank)
- Escalar/rotar imágenes en hover por defecto

### Copy
- Mismo texto repetido dentro de un contenedor
- Cadencia aforística ("Not X. Just Y.") y el framing "theater"
- Buzzwords genéricos sin el vocabulario del negocio

### Imaginería
- Ilustración ensamblada de formas SVG genéricas
- Imágenes rotas o placeholder (src vacío, cajas grises)

### Calidad general (el suelo)
- Errores de script al cargar; contenido en opacity:0 sin reveal
- Contraste que suspende WCAG AA (4.5:1 body)
- Saltos de nivel de heading (h1→h3)
- Texto justificado sin hyphenation

## El matiz que evita malentendidos

Un patrón NO es slop si la **referencia** lo usa con intención y el orquestador
lo especificó — slop es el *default no elegido*. Ejemplos: el mono-uppercase
del sitio de Noon es una decisión de sistema del owner (spine mono-forward);
un status dot que representa estado REAL (el del studio) es semántica, no
decoración. La vara del juez: **¿esto fue elegido o fue lo que salió?** —
combinada con la regla de fidelidad (¿está en la referencia?).

## Cruce con lo ya construido

Las 9 craft rules del system prompt de v0 (c8a1f62) ya bloquean: un solo
acento, jerarquía por peso, contenido real sin lorem, motion 150-250ms,
contraste AA, escala de espaciado. Este catálogo añade la lista NEGATIVA
explícita (S1-S9 + categorías) que faltaba para: el juez, el copy del
orquestador y las reglas negativas del prompt de v0.

## Fuentes

- [Impeccable — Slop catalogue (61 patrones)](https://impeccable.style/slop/)
- [Developers Digest — 16 AI design slop patterns](https://www.developersdigest.tech/blog/ai-design-slop-and-how-to-spot-it)
- [925 Studios — AI slop web design guide 2026](https://www.925studios.co/blog/ai-slop-web-design-guide)
- [Why Your AI Keeps Building the Same Purple Gradient Website](https://prg.sh/ramblings/Why-Your-AI-Keeps-Building-the-Same-Purple-Gradient-Website)
- [VibeCodeKit — AI slop design fix guide](https://vibecodekit.dev/ai-slop-design)
