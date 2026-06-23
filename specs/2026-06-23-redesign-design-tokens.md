# Noon — Design System Spec (Redesign v1)

*2026-06-23 · Single source of truth para el rediseño. Codifica las 6 decisiones del spine. Usar este doc para configurar el Design System en Claude Design **y** para construir en código. Colores tomados de `Noon_Paleta_v3.pdf` (auditada).*

---

## 0 · North star + reglas duras

**Dual (light por defecto) · sans con peso · mono-forward** — negro y aire mandan, el azul es una chispa precisa — con grilla técnica de línea fina como acento y firma de ilustración wireframe/sistémica. Botones **pill, todo flat.** *AI-platform premium con calidez contenida.*

Reglas que no se rompen:
1. **Todo color sale de un token semántico** que resuelve por tema. Nunca un hex suelto en un componente.
2. **El azul es acento, no campo.** Default a negro/neutro; el azul solo para los roles listados en §1.
3. **Cada referencia se traduce a estos tokens** — se roba la idea, se reconstruye la ejecución. No se pega.

---

## 1 · Color

### Marca (escaso)
| Token | Hex | Rol |
|---|---|---|
| `--brand` | `#1200C5` | **Azul de marca, ESCASO.** Solo: CTA primario-azul (máx 1 por página, ver §7), estado activo/nav, logo, highlight de data-viz/ilustración, focus ring. |
| `--brand-hover` | `#2E1CFF` | Hover del azul. |
| `--accent` | `#00D4FF` | Cyan eléctrico — highlight secundario / info. Aún más escaso que `--brand`. |

> **El botón primario NO es azul** → es negro/neutro (mono-forward). Ver §7.

### Neutrales (ambos modos, alineados al azul; omite el 600 a propósito)
`900 #0A0A23` · `800 #1A1A2E` · `700 #2A2A44` · `500 #6B6B7D` · `400 #9CA3AF` · `300 #D1D5DB` · `200 #F3F4F6`

### Superficies semánticas (resuelven por tema)
| Token | Light (default) | Dark |
|---|---|---|
| `--bg-base` | `#FFFFFF` | `#09090F` |
| `--bg-secondary` | `#F7F8FC` | `#11111A` |
| `--surface` | `#F1F2F7` | `#121230` |
| `--border` | `#E6E8F2` | `#1F1F33` |
| `--hover` | `#EEF0FF` | `#272742` |
| `--text-primary` | `#111827` | `#FFFFFF` |
| `--text-secondary` | `#6B7280` | `#9CA3AF` |
| `--text-muted` | `#9CA3AF` | `#6B6B7D` |

### Estado (semántico, NO decorativo)
`success #00C853` · `warning #FFB300` · `error #FF3B6E` · `info #00D4FF`
Fondo de alerts/banners al **10–15% de opacidad**; color pleno solo para ícono/borde/texto de estado.

---

## 2 · Tipografía

**Una sola sans, con peso.** Familia = **A/B en la galería: Geist (free) vs Söhne (premium)** · fallback free = Neue Montreal. Se cierra viéndola en contexto.

| Rol | Tamaño | Peso | Tracking | Line-height |
|---|---|---|---|---|
| Display / hero | 64–80 | 600–700 | −0.02em | 1.05 |
| H1 | 44–52 | 600 | −0.02em | 1.1 |
| H2 | 32–36 | 600 | −0.01em | 1.15 |
| H3 | 24 | 600 | 0 | 1.2 |
| Lead / H4 | 18–20 | 500 | 0 | 1.4 |
| Body | 16 | 400 | 0 | 1.6 |
| Small | 14 | 400 | 0 | 1.5 |
| Kicker / label | 12 | 500 | +0.08em · UPPERCASE | 1.4 |

Pesos a cargar: **400 / 500 / 600 (+700 display).** El "peso" = peso alto + tracking apretado en display. Heros de 2–3 líneas, izquierda o centrado.

---

## 3 · Espaciado & layout

- **Base 8px.** Escala: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128`.
- Container contenido: **1200–1280px**; full-bleed: 1440.
- Ritmo entre secciones mayores: **96–128px** (airy).
- Gutters: 24–32px · Grid: 12 columnas.

---

## 4 · Grilla / ticks (HÍBRIDO — solo zonas técnicas)

- **Default: invisible** (aire + alineación).
- **En secciones técnicas** (features, specs, diagramas): hairlines 1px `--border` entre columnas/filas + **ticks de esquina** (cruz de ~12px, color `--border`) en las esquinas del marco de grilla.
- Nunca decorativo en todo el sitio — es un acento deliberado.

---

## 5 · Radio & elevación (FLAT)

- **Radio:** botón/chip = **pill (9999px)** · card/surface = **12px** (`--radius-md`) · input = 8px.
- **Elevación: FLAT.** Sin drop-shadows. La profundidad sale de **bordes 1px + diferencia de bg** (surface vs bg). Excepción única posible: sombra muy sutil en un popover flotante.

---

## 6 · Ilustración / lenguaje visual (MIX GOBERNADO)

- **Estilo:** línea fina (1–1.5px), **monocromo** (usa `--text-primary` / `--border`, invierte por tema), geométrico.
- **DEFAULT = abstracto sistémico:** grafos de nodos, campos de puntos, wireframe geométrico (globo/grilla/diamante). Para heros, texturas de sección, data-viz, momentos de marca.
- **"HOW IT WORKS" ÚNICAMENTE = isométrico line-art** (objetos/escenas/devices en wireframe).
- Azul (`--brand`) escaso dentro de la ilustración (un nodo, un highlight). El resto, mono.
- Los dos estilos comparten **mismo grosor de línea + paleta mono** → una sola familia.

---

## 7 · Componentes núcleo

- **Botón primario:** pill · bg `--text-primary` · texto `--bg-base` → **invierte por tema** (negro/blanco en light, blanco/negro en dark). Sin sombra.
- **Botón secundario:** pill · bg transparente/`--surface` · borde 1px `--border` · texto `--text-primary`.
- **Botón azul (CTA héroe, raro):** pill · bg `--brand` · texto blanco. **Máx 1 por página.**
- **Icon button:** **círculo negro** (`--text-primary` bg, ícono inverso) — flechas/menú (la firma de #9).
- **Kicker / eyebrow:** 12px UPPERCASE, tracking +0.08em, `--text-muted`, suele llevar slash o número (`/ WORK`, `001`, `API TOOLCHAIN`).
- **Card:** bg `--surface` · borde 1px `--border` · radio 12px · sin sombra · hover bg `--hover`.
- **Feature row:** 3–4 columnas; cada una = número/ícono + título (H3) + 1–2 líneas + ilustración de línea opcional; divisores hairline en modo técnico.
- **Stepped progress:** Step 1–N; activo = pill negro lleno; inactivo = borde.
- **Nav:** top bar mínima · logo izq · links · 1 CTA (secundario o el azul raro).
- **Logo strip:** "Trusted by…" · logos en grayscale a baja opacidad.

---

## 8 · Motion

Sutil y rápido: **150–250ms ease-out.** El hover levanta por color/borde, no por movimiento grande. Reduced-motion safe.

---

## 9 · Cómo se usa

1. Configurar el proyecto **"Noon Design System"** en Claude Design con §1–§8 como el sistema.
2. Generar **primero la GALERÍA** (kitchen-sink: todos los tokens + componentes en una pantalla, con las 2 tipos candidatas) → test de coherencia + A/B de fuente.
3. Después, generar páginas **contra este sistema**, pasando cada referencia como *"adoptá X, en NUESTRO sistema"* — nunca *"copiá esta referencia"*.
