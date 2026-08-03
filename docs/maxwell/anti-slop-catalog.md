# Catálogo anti-slop — los tells de UI generada, anotados (2026-08-02)

> Investigación encargada por el owner ("NO AI SLOP… como el típico tag en cada
> título, investiga bien para que los tengamos identificados"). Consolidado de
> los catálogos de la comunidad — **Impeccable** (61 patrones,
> impeccable.style/slop) y Developers Digest (16) más guías de 2026 —
> deduplicado, ordenado por severidad y **anotado patrón a patrón** bajo la
> doctrina del owner:
>
> **"Solo deben utilizarse cuando la situación lo amerite, cuando entren
> mejor — nunca porque sí."**
>
> **Definición operativa de slop:** slop es lo que aparece cuando el ejecutor
> tuvo que decidir algo que el orquestador no especificó. No es "hecho por IA"
> — es "no elegido por nadie".
>
> **Cómo lo usa el juez:** no pregunta "¿está el patrón?" sino "¿está SIN
> mérito?" — ¿lo pide la referencia o la familia? ¿cumple una función que se
> puede nombrar? Sin respuesta = slop. Los marcados **[sin excepción]** son
> defectos absolutos: no existe situación que los amerite.

## Nivel S — los inequívocos (máxima vigilancia)

| Tell | Slop cuando (default) | Amerita cuando |
|---|---|---|
| **S1 · Badge/pill sobre el H1** | Pastilla genérica ("✨ AI-powered") puesta por plantilla | Anuncio REAL y noticiable (lanzamiento, versión, fecha), una sola vez en el hero, estilado al sistema — como lo usan Vercel/Linear |
| **S2 · Kicker/eyebrow uppercase por sección** | Muletilla en cada título | La identidad editorial/mono de la referencia lo posee (es voz del sistema, no relleno) — y aun así con moderación |
| **S3 · Borde lateral de color en cards** | Decoración de cards normales | Semántica real: callouts/alertas donde el color codifica tipo (warning/info), o blockquote editorial clásico |
| **S4 · Morado/violeta + cian sobre oscuro** | Paleta por defecto sin marca detrás | La MARCA del cliente es esa, o la familia la posee por referencia (Linear ES #5E6AD2 — nuestro pack tech-digital lo usa por eso, no por default) |
| **S5 · Dark mode + glows de color** | Glow decorativo en todo, gris medio que suspende AA | Familias cinematic (automotive, industrial, energy) con glow mínimo y FUNCIONAL (foco, estado) — jamás halos de fondo porque sí |
| **S6 · Inter / Space Grotesk / Instrument Serif** | Elegidas por reflejo (son el default de todas las herramientas) | El token de la familia las elige a propósito (Inter es correcto en fintech/logistics); Instrument Serif casi nunca |
| **S7 · Hero centrado + grid de cards idénticas icon-top** | La plantilla universal para cualquier negocio | Hero centrado si el mensaje es UNA frase y la familia lo pide; grid solo si los items son genuinamente paralelos, ≤6, con iconos distintivos |
| **S8 · Emoji como iconografía** | En nav, features o titulares | Producto consumer juguetón (eventos Gen Z, mascotas) cuyo tono lo pide — acentos puntuales, nunca sistema de iconos |
| **S9 · Buzzwords / métricas inventadas / em-dashes** | "Streamline/empower/unlock", "10x · 99%", em-dashes en cadencia de IA | Buzzwords y métricas inventadas: **[sin excepción]**. Em-dash: puntuación editorial real, máx. una por párrafo |

## Detalle visual

| Tell | Slop cuando | Amerita cuando |
|---|---|---|
| Grid decorativo de fondo | Textura sin función | El grid evoca el producto real (canvas, mapa, plano, dev-tool) |
| Glassmorphism | Blur en cards estáticas | Overlays reales (modal, barra sticky) donde el blur conserva contexto |
| Hairline border + sombra ancha | Los dos a la vez como firma generada | Elegir UNO; sombra difusa solo en elevación real (popover, menú) |
| Rayas repeating-gradient | Decoración de superficie | Textura de marca que la referencia posee (rara) |
| Border-radius extremo (24px+) | Cards de contenido amorfas | Pills/chips por naturaleza; familias soft (beauty, pets) con escala consistente |
| SVG "hand-drawn" amateur | Ilustración cruda accidental | **[sin excepción]** en generado — lo naive solo funciona como dirección de arte encargada |
| Halo/spotlight radial | Haze de acento tras secciones | UN punto focal en hero dark de familia cinematic, sutil |
| Texto en gradiente | Titulares ilegibles al escanear | Máx. una palabra display en familias creative si la referencia lo hace |
| Beige/crema por defecto | Fallback cálido sin sistema detrás | La familia ES warm con paleta completa (warm-artisanal, premium-experiential lo tienen POR token) |

## Tipografía

| Tell | Slop cuando | Amerita cuando |
|---|---|---|
| Jerarquía plana (tamaños próximos) | — | **[sin excepción]** — es defecto, no patrón |
| Texto funcional <11px / body <12px | Links, labels, tablas ilegibles | Solo metadata técnica densa (tablas de dashboard, mono labels) con AA |
| Icon-tile apilado sobre título | Cuadradito idéntico de relleno ×6 | Features B2B con iconos genuinamente distintivos, si la referencia usa el patrón (Stripe) |
| Serif itálica display gigante | Una palabra itálica suelta en página Inter (cliché) | La familia editorial la posee como voz consistente (fashion, arte) |
| Letter-spacing aplastado | Ilegible en display | Display grande admite tracking negativo LEVE (−0.01/−0.02em) |
| Una sola fuente para todo | Sin jerarquía compensatoria | Sistema mono-tipo deliberado (nuestro clean-professional Inter/Inter) donde peso+tamaño hacen la jerarquía — el token lo especifica |
| Body en ALL-CAPS | Párrafos completos | Caps solo en labels cortos con tracking |
| Headline frase-completa a escala masiva | Domina el viewport sin mensaje | Mensaje CORTO en familia display-driven (creative, automotive) |

## Layout y espacio

| Tell | Slop cuando | Amerita cuando |
|---|---|---|
| Numeritos editoriales junto a títulos | Muletilla de estructura de revista | El sistema editorial/mono los posee (el sitio de Noon los usa POR decisión del owner) |
| Hero-metric layout (número grande + 3 stats) | Fórmula con métricas inventadas | Productos de datos donde el número ES el producto — y las métricas son reales |
| Stat banners uniformes | Fila de stats porque sí | Solo métricas reales, si la referencia usa el patrón |
| Secuencias "1, 2, 3" | Tres columnas idénticas de muletilla | El proceso real TIENE pasos y se diseña con voz propia |
| Cards anidadas | Cards dentro de cards dentro de cards | Máx. 2 niveles con jerarquía clara de superficie |
| Espaciado monótono | Un solo valor en toda la página | **[sin excepción]** — el ritmo (juntar lo relacionado, separar grupos) es regla de craft |
| Líneas >80 caracteres · overflow · clipping · títulos pegados · texto al borde | — | **[sin excepción]** — defectos |

## Motion

| Tell | Slop cuando | Amerita cuando |
|---|---|---|
| Status dot pulsante | Decorativo sobre estado estático | El estado es REAL y vivo (el dot semántico del studio) |
| Cursor parpadeante falso | Caret fake en copy del hero | Solo si evoca un editor real (producto de escritura/terminal) |
| Marquee auto-scroll | Esconde contenido, velocidad de feria | Strip de logos en familias editorial/fashion: lento, pausable, respeta prefers-reduced-motion |
| Bounce/elastic easing | Dialogs y cards de trabajo | Productos juguetones (pets, eventos) con moderación |
| Animar width/height/padding | — | **[sin excepción]** — jank; transform/opacity siempre |
| Zoom de imagen en hover | Zoom dramático por defecto | Sutil (1.02–1.03) en galerías/e-commerce donde indica clic |

## Copy

| Tell | Slop cuando | Amerita cuando |
|---|---|---|
| Mismo texto repetido en un contenedor | — | **[sin excepción]** — defecto |
| Cadencia aforística ("Not X. Just Y.") / framing "theater" | Copy de manifiesto en prototipo de cliente | **[sin excepción]** en prototipos — el negocio habla, no el modelo |
| Buzzwords genéricos | Cualquier aparición | **[sin excepción]** — vocabulario del negocio siempre |

## Imaginería

| Tell | Slop cuando | Amerita cuando |
|---|---|---|
| Ilustración ensamblada de formas SVG | Hero de shapes genéricas | Solo como sistema de marca deliberado; en nuestro flujo, preferir foto verificada |
| Imagen rota / placeholder / caja gris | — | **[sin excepción]** — la regla de imaginería ya lo prohíbe |

## Calidad general — el suelo **[todo sin excepción]**

Errores de script al cargar · contenido en `opacity: 0` sin reveal · contraste
que suspende WCAG AA (4.5:1 body) · saltos de nivel de heading (h1→h3) ·
line-height <1.3 · body <12px · justificado sin hyphenation · padding
asfixiado. No hay familia, referencia ni "situación" que los amerite: son
defectos y el juez los suspende directo.

## Cruce con lo ya construido

Las 9 craft rules del system prompt de v0 (c8a1f62) ya bloquean varios por la
vía positiva (un acento, jerarquía por peso, contenido real, motion 150-250ms,
AA, escala de espaciado). Este catálogo aporta la **doctrina de mérito** que
faltaba: el juez evalúa presencia-sin-mérito, el copy del orquestador respeta
los [sin excepción], y el prompt de v0 recibe los Nivel S como reglas
negativas explícitas con sus excepciones nombradas.

## Fuentes

- [Impeccable — Slop catalogue (61 patrones)](https://impeccable.style/slop/)
- [Developers Digest — 16 AI design slop patterns](https://www.developersdigest.tech/blog/ai-design-slop-and-how-to-spot-it)
- [925 Studios — AI slop web design guide 2026](https://www.925studios.co/blog/ai-slop-web-design-guide)
- [Why Your AI Keeps Building the Same Purple Gradient Website](https://prg.sh/ramblings/Why-Your-AI-Keeps-Building-the-Same-Purple-Gradient-Website)
- [VibeCodeKit — AI slop design fix guide](https://vibecodekit.dev/ai-slop-design)
