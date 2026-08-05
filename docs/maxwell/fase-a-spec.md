# Fase A — El cerebro de generación (spec definitiva)

> **Estado: definición CERRADA** — aprobada por el owner punto por punto
> (2026-08-02 → 2026-08-04), incluida una revisión crítica adversarial de 5
> puntos y la definición completa del flujo de referencias del cliente.
> Construcción pendiente en 3 entregas (§ Construcción). Sustituye a
> `quality-layer.md` (mayo 2026) como fuente de verdad del pipeline de
> generación; hermana de `anti-slop-catalog.md`; complementa
> `docs/mvp-auto-pipeline-spec.md` (que gobierna lo que pasa DESPUÉS del pago).
>
> *Del pedido del cliente al prompt milimétrico. Nada se genera hasta que el
> paquete esté completo.*

## Constitución vigente (reglas del owner que este pipeline obedece)

- **Orquestador / ejecutor**: el que decide y ordena = el mejor modelo; el que
  ejecuta órdenes completas = mucho más barato. "Soy el orquestador: toma
  todos los recursos, el camino y todo lo que necesitas — tú solo ejecuta."
  El coste se corta en las manos, nunca en el cerebro.
- **Cada modelo en el asiento de su especialidad** (tarea #37).
- **Economía de tokens**: ninguna llamada nueva si se puede extender una
  existente; caché de todo; generar imágenes es excepción y se archiva.
- **Fidelidad a la referencia**: cero recursos genéricos — coincidencia en
  sujeto, composición, contexto, luz, perspectiva y sensación (sofá ≠
  escritorio), aplica a TODO; + cláusula de escala (geometría por slot,
  recortabilidad, hermanos a tamaño hermano, logos por altura visual).
- **Doctrina de mérito anti-slop**: los patrones solo cuando la situación lo
  amerite, nunca porque sí (ver `anti-slop-catalog.md`).
- **Regla 0**: el cliente JAMÁS ve un error ni un bloqueo — todo fallo degrada
  en silencio. **Refinada aquí**: los *errores nuestros* son invisibles; las
  *decisiones del cliente* nunca se ignoran calladamente.
- **v0 solo visual** (`imageGenerations: false`): frontend puro, mock data
  estática, cero backend. La funcionalidad la implementa el desarrollador.

---

## El flujo

### 1 · La conversación (antes de generar nada)

- **Guion por etapas, al ritmo del cliente**: entender el negocio → objetivo →
  alcance → estilo y referencias → confirmar → generar. Cada información se
  pide en SU etapa, nunca antes ni fuera de contexto. El guion marca el orden;
  el cliente marca el paso. Ninguna etapa es peaje obligatorio.
- **Acciones rápidas dentro del mensaje** — principio de diseño de todo el
  studio: *"la acción vive en el mensaje, no en el menú"*. En la etapa de
  estilo, Maxwell pregunta si el cliente tiene referencias y si quiere que
  busquemos nosotros — con los tres caminos como botones en el propio mensaje:
  **[Tengo mi referencia] · [Busquen ustedes] · [Omitir]**. Las referencias
  nunca son obligatorias.
- **Referencia del cliente**: URL, o hasta **3 imágenes de UNA misma
  referencia** (no 3 referencias distintas). Subida con seguridad: tipo y
  tamaño verificados, metadatos ocultos borrados (EXIF con ubicación),
  almacenamiento seguro.
- Si el cliente menciona la **web actual de su negocio**, la misma maquinaria
  de análisis la visita y extrae su marca real (colores, logo) — la
  personalización más fuerte que existe, gratis.

### 2 · El estudio (arranca cuando el cliente SOLICITA el prototipo)

- **Nada de investigar antes** (decisión del owner — sin prefetch): solo al
  solicitar sabemos todo lo que quiere. La espera se muestra como **etapas
  visibles y honestas** en la tarjeta de progreso del chat: *"Estudiando
  referencias → Preparando recursos → Generando tu prototipo"* — cocina a la
  vista; jamás un spinner mudo, jamás un error.
- **Clasificación** — *GPT-5.6 Luna (ejecutor; migra desde gpt-4.1-mini: más
  nuevo y más barato)*. Una sola llamada: familia visual (1 de 24) + términos
  de búsqueda del dominio del negocio.
- **Selección de referencias** — *código + pool curado, sin LLM en runtime*:
  - Referencia del cliente → **primaria automática**, con **guardia SSRF**
    obligatoria para URLs ajenas (solo http/https, bloqueo de IPs internas,
    navegador aislado, timeout duro).
  - Sin referencia del cliente → pool curado de su familia (nace con las 72
    actuales).
  - **Máx. 2-3 por proyecto, con jerarquía**: 1 primaria (columna vertebral)
    + 1-2 secundarias para secciones concretas. Convergencia — nunca promedio
    Frankenstein.
- **Las galerías** (Godly, Landbook, Awwwards, Mobbin, Curated.design — no
  Pinterest) **alimentan el pool OFFLINE**: pasada periódica que caza,
  captura, analiza y guarda referencias ya fichadas. El runtime solo elige.
- **El pool se auto-diagnostica**: cobertura débil para un caso ("funeraria
  moderna") → se anota solo en la cola de curación — su propia lista de
  compras para la pasada offline.
- **Taste** gobierna aquí: qué referencia *merece* entrar al pool (real,
  actual, excepcional, original) y cuál corresponde a *este* proyecto.

### 3 · El análisis milimétrico (medir + juzgar)

- **Playwright MIDE** lo medible en la página real (CSS computado): fuentes,
  pesos, tamaños en px, line-heights, tracking, hex exactos, paddings, gaps,
  anchos de contenedor, radios, sombras, breakpoints — en **desktop Y móvil**,
  con captura **troceada por secciones** (las páginas largas degradan a los
  modelos de visión).
- **GPT-5.6 Sol (orquestador) JUZGA** lo que solo el ojo juzga, recibiendo
  medidas + capturas: estructura, jerarquía, composición, patrones UX, CTAs,
  recursos visuales, motion, y el campo **"por qué funciona"** (taste) — con
  los criterios de *impeccable* y *frontend-design* como campos de la ficha.
- **Ficha estructurada con regla anti-adjetivo**: todo campo lleva valor (px,
  hex, ratio, conteo) o no entra. "Espaciado generoso" prohibido; "~120px
  entre secciones, gap 24px" sí.
- **Cacheada por referencia** — se paga una vez en la vida del sistema; el
  sistema se acelera solo con las semanas.
- **Las fichas caducan** (aprobado 2026-08-04): las páginas cambian, así que
  cada ciertos meses la pasada periódica **re-visita los sitios y actualiza
  los análisis viejos** automáticamente — nunca describir un diseño que ya no
  existe (la guía de restaurantes que se revisa sola).

### 4 · La confirmación del cliente (un tap, una vez)

- **Tarjeta de dirección visual** en el chat (componente
  `components/maxwell/reference-direction-card.tsx`, aprobado): las 2-3
  referencias **viéndose de calidad** — retina, hero encuadrado, mismo ratio y
  marco, limpias de banners, pre-cargadas. La captura fea no se enseña — rota
  a la siguiente del pool.
- Anatomía aprobada: título solo, capturas grandes **seleccionables por tap**
  (chip "Primaria" + borde azul siguen la selección; arranca en la
  recomendada), descriptores de 3-4 palabras, acciones simétricas:
  **[Continuar con esta dirección]** (primario, ancho completo) +
  **[Prefiero otra] · [Usar mi referencia]** (mitades exactas).
- **Un tap decide.** Solo se enseña lo ejecutable — nunca prometemos lo que no
  cumpliremos.
- **Sin confirmación NO se genera** (owner, 2026-08-05 — revierte el
  auto-continuar por timeout): si el cliente no responde, puede que
  simplemente se haya ido — y el gasto grande no se hace sin señal de
  interés. El flujo espera en la tarjeta; no es un flujo congelado, es una
  decisión pendiente DEL cliente. Al volver, la tarjeta sigue ahí y los
  análisis están cacheados: su tap retoma al instante. Sin confirmación, la
  única exposición son los céntimos del estudio (mayormente cacheado) —
  jamás la generación.
- Consecuencia: toda dirección generada fue confirmada explícitamente por el
  cliente, así que un cambio de estilo posterior es una corrección normal
  (no existe el caso "dirección elegida por silencio").
- **La dirección es pegajosa**: se confirma UNA vez por sesión; correcciones y
  regeneraciones no re-preguntan (el barbero pregunta al sentarte, no en cada
  tijeretazo). Solo se re-pregunta si el cliente pide cambiar de estilo.
- **La tarjeta es el momento del cliente apurado** (aprobado 2026-08-04): el
  que se saltó la conversación y nunca llegó a la etapa de referencias recibe
  la pregunta AQUÍ, vía "Usar mi referencia". Nadie se queda sin la pregunta;
  a nadie se le obliga a conversar.
- Doctrina: **el cliente manda la dirección; Noon manda la calidad de
  ejecución** (su referencia se ejecuta con nuestro suelo de calidad, no se
  copia con sus defectos).

#### El flujo "Usar mi referencia" (cerrado 2026-08-04)

1. Al tocarlo, Maxwell pide en el chat: hasta **3 imágenes de una misma
   referencia**, o el enlace.
2. **La referencia no tiene que ser una página web.** Una foto, un cartel, un
   interior — cualquier cosa visual que comunique colores, estilo,
   composición o luz es válida si ayuda a entender lo que busca.
3. **Confirmar la lectura**: Maxwell dice lo que entendió antes de seguir —
   *"Viendo tu imagen, entiendo que buscas tonos cálidos y un aire artesanal —
   ¿estoy en lo correcto?"*. Nunca se genera sobre una interpretación no
   confirmada.
4. **Referencia parcial**: sus aspectos mandan (p. ej. la paleta del cartel);
   lo que no cubre lo completa por dentro el estudio del sector — **solo si se
   sabe con confianza**. Si falta información importante, se pregunta — una
   pregunta corta y concreta, no un interrogatorio. **Nunca a ciegas, nunca
   fastidiosos.**
5. **Solo se pide otra referencia cuando de verdad no se entiende la
   intención** (calidad realmente inservible). Si "más o menos se entiende",
   se trabaja con ella.
6. **Si de verdad no sirve**, se le dice claro y amable, con esta escalera:
   ¿versión de mejor calidad? → ¿el enlace del sitio original? → ¿otra
   referencia? → ¿o descríbemela con tus palabras? — y solo como último
   recurso, nuestra selección otra vez.
7. **Su decisión se respeta**: elegida su referencia, jamás le re-mostramos
   las nuestras automáticamente (preguntar si quiere verlas es lo máximo —
   preguntar, nunca imponer). Internamente sí pueden usarse como conocimiento
   para completar huecos.
8. **Si su URL no se puede capturar** (página caída, bloqueada), NO se ignora
   en silencio — Regla 0 refinada: *"No pude acceder a tu referencia — ¿me
   pasas otra, o sigo con estas dos que elegí?"*, con sus botones ahí mismo.

### 5 · La orden (una sola llamada del orquestador — GPT-5.6 Sol)

De la ficha + la conversación completa produce:

- **Shot list por slot de imagen**: sujeto, composición, contexto, luz,
  perspectiva, sensación (la regla del sofá) + **geometría obligatoria**:
  ratio objetivo, resolución mínima, punto focal (hero 16:9, cards 4:3
  uniformes, retratos 1:1, logos por altura visual).
- **Copy real del negocio**: titular, subtítulos, CTAs y secciones con su
  vocabulario y en su idioma — cero relleno, cero "Elevate your business".
- **Datos con forma real**: nombres plausibles, precios coherentes entre sí,
  fechas recientes.
- **Arquitectura de secciones con propósito nombrable** — si no se puede
  nombrar el trabajo de una sección, no existe.
- **Regla de conflicto**: si hay referencia primaria, **su ficha manda sobre
  el token de familia** (paleta/tipos); el token queda de respaldo.

### 6 · Los recursos (cascada: buscar antes que generar)

- **Nivel 0 — librería propia de Noon**: solo coincidencias verificadas por
  slot y familia; cada generación IA aprobada se archiva aquí → el coste se
  paga una vez y el sistema se compone con el tiempo.
- **Nivel 1 — APIs**: Pexels ya integrada (fotos + vídeo 4K); **Lummi cuando
  el owner tenga acceso** (art-directed, el anti-stock).
- **Nivel 2 — Deterministas, coste cero**: Logoipsum (logos placeholder B2B),
  DiceBear (avatares ilustrados, SOLO familias playful — en premium siempre
  retrato real), Lucide (ya en stack), SVGs de fondo por familia
  (fffuel/Haikei, generados una vez, tintados por paleta).
- **Nivel 3 — gpt-image-2, último recurso**: solo si 0-2 fallan; hereda el
  brief completo del slot como orden; lo aprobado se archiva en Nivel 0.
- **Verificación de coincidencia EN LOTE** — *GPT-5.6 Luna (visión, ejecutor
  con checklist)*: **todos los candidatos en UNA llamada** (grid + checklist),
  contra los 6 atributos + **recortabilidad** (la foto perfecta cuyo sujeto
  muere al recortarla al ratio del slot, se rechaza). La aduana entre el
  buscador (palabras clave, tonto) y el prompt: **no coincide = fuera, aunque
  sea bonita.**

### 7 · El prompt milimétrico (ensamblaje puro, $0)

- Estructura oficial de v0 (Build / Used by / To / Constraints — la que según
  Vercel evita que v0 invente) conteniendo: la ficha del análisis · los
  recursos verificados con su rol y geometría · el copy y datos **fijos**
  (contenido, no sugerencia) · paleta y tipografías (primaria > token de
  familia; **la marca del cliente sobreescribe** si existe) · las 9 craft
  rules · **el Nivel S del anti-slop prohibido** con su doctrina de mérito ·
  normalización (hermanos a tamaño hermano, object-cover con foco) · idioma
  de UI = el del cliente.
- **Estilo del prompt**: notación técnica estándar (el idioma nativo de v0),
  valores en vez de descripciones, telegráfico — sin porqués ni cortesías.
  **La precisión ES la compresión** — el prompt nace compacto.
- **Presupuesto de tamaño automático**: si no cabe, se recorta lo prescindible
  (detalle fino de ficha, turnos viejos) y jamás el pasaporte (copy, recursos,
  paleta, reglas duras). Con el estilo telegráfico, casi nunca actúa.

### 8 · v0 ejecuta (ejecutor, SOLO visual, imageGenerations OFF)

"Toma todos los recursos, el camino y todo lo que necesitas — tú solo ejecuta
y listo."

### 9 · Las correcciones (no degradan lo construido)

Cada orden de cambio **va con los planos pegados**: el ADN del diseño (ficha,
paleta, tipos) viaja en cada corrección. Si el cambio pide algo nuevo ("añade
testimonios") → **mini-pipeline solo para los slots nuevos**: shot list de
esos slots + búsqueda + verificación en lote. La corrección №3 se ve tan bien
como la versión №1.

### 10 · Recetas, seguridad y cuentas

- **Receta guardada por prototipo**: referencias usadas, ficha, fotos
  elegidas (y de qué nivel salieron), decisión del cliente, orden final a
  v0 — para diagnosticar sin adivinar y alimentar el futuro (salón de la
  fama, perfil de gusto del owner, telemetría). Coste ≈ 0: es información que
  ya producimos.
- **Regla 0 en cada paso**: galerías caídas → pool estático · sin fotos →
  brief sin bloque de imaginería · análisis falla → tokens de familia. El
  cliente jamás ve error ni bloqueo.
- **Contadores desde el día 1**: ahorros de caché, rechazos del verificador,
  coste real por prototipo — decisiones futuras con números, no sensaciones.
- **Toda llamada al ledger** de presupuesto (`lib/server/llm-budget`) con su
  categoría y tope duro — incluido **tope por prototipo** (cubre el peor
  caso). **Modelos cambiables por env** (cambiar uno = una variable).

---

## Modelos por asiento

| Asiento | Modelo | Rol |
|---|---|---|
| Clasificación (familia + términos) | GPT-5.6 Luna | Ejecutor barato con orden completa |
| Análisis de referencia (juzgar) | GPT-5.6 Sol | Orquestador — el mejor en su trabajo |
| La orden (shot list + copy + datos) | GPT-5.6 Sol | Orquestador |
| Verificación de fotos (lote, visión) | GPT-5.6 Luna | Ejecutor con checklist |
| Generación visual | v0 | Ejecutor, solo visual |
| Generación de imagen (último recurso) | gpt-image-2 | Ejecutor, hereda el brief del slot |
| Medición | Playwright | Determinista, $0 |

## Skills

- **taste** → admisión al pool · selección por proyecto · campo "por qué
  funciona" de la ficha.
- **impeccable + frontend-design** → campos de la ficha de análisis · craft
  rules del prompt · (en Fase B) rúbrica del juez.
- **Las tres se leen línea a línea al construir** y se destila su método real,
  no su nombre. Instalación como **allowlist deliberada** — leídas, fijadas,
  nunca auto-instalación (Find Skills y autoskills: evaluadas y descartadas;
  ver tarea #42).

## Coste y tiempo (números honestos)

- **Típico**: ~$0.06–0.12 por prototipo fresco → ~$0.03–0.05 con cachés
  calientes (encima del coste actual de v0).
- **Peor caso**: cliente que trae 3 referencias jamás analizadas → ~**$0.20**;
  tope por prototipo en el ledger para que ni ese caso se descontrole.
- **Tiempo**: el estudio fresco añade **~1-2 minutos** al primer prototipo,
  visibles como etapas de trabajo (no espera muda). Las cachés se lo comen
  con las semanas.

## Aceptación (antes de desplegar nada)

- **Existe SOLO al inicio, antes de operar** (aclarado por el owner
  2026-08-05): es el examen de graduación del cerebro nuevo — se hace una
  vez, para confirmar y verificar internamente, y **después deja de
  existir**. En operación real jamás se generan dos versiones.
- **Prueba antes/después, manual y única**: 2-3 proyectos de prueba de
  familias distintas, cada uno generado dos veces (sistema viejo vs. cerebro
  nuevo), capturas lado a lado — **el owner juzga con los ojos**. No se
  despliega lo que no gane. Nada se genera solo, nada queda corriendo; tras
  la prueba sigue siendo **un prototipo por cliente, cuando lo pide**.
- El arnés de comparación **se desmonta al aprobar**: un camino principal +
  el camino simple como red de emergencia dormida (Regla 0).

## Construcción en 3 entregas (aprobado 2026-08-04)

**Principio de construcción (owner, 2026-08-04): modificar, no sobrescribir.**
Lo ya construido (clasificador, prototype-brief, style packs, Pexels, craft
rules) se **evoluciona en su sitio** hasta dejarlo actualizado — nunca un
sistema nuevo en paralelo compitiendo con el viejo, nunca dos fuentes de
verdad chocando. En cada paso intermedio el pipeline completo sigue
funcionando y coherente. El único "camino viejo" que sobrevive es la red de
emergencia dormida de la Regla 0 — que es el mismo pipeline degradado, no un
rival.

1. **El cerebro** — estudio + análisis + ficha + caché · la orden (shot list
   + copy + datos) · verificación en lote · ensamblaje del prompt ·
   degradaciones. Se prueba en privado con el antes/después. *Checkpoint: el
   owner juzga si el salto de calidad es real.*
2. **La experiencia** — guion por etapas · cablear la tarjeta de confirmación
   al flujo real (con todo el flujo "Usar mi referencia") · botones en
   mensajes · composer con imagen · etapas visibles.
3. **El blindaje** — correcciones con planos · recetas · guardias (SSRF,
   subida segura) · caducidad de fichas · pasada offline de galerías ·
   contadores.

**Ya construido** (`c8a1f62` + tarjeta): clasificador (pendiente migrar de
modelo), búsqueda Pexels base, plantilla v0 + 9 craft rules, tokens de las 24
familias, catálogo anti-slop anotado, tarjeta de confirmación (componente +
banco dev en `/maxwell/tracepreview`).

**Gestión del owner**: `PEXELS_API_KEY` (pexels.com/api, gratis) — sin ella,
el antes/después saldrá sin fotos reales. Lummi puede esperar.

## Después de A

**Fase B** (se define cuando el owner vea A funcionando): Playwright captura
el RESULTADO de v0 en 3 viewports + suelo determinista (consola, fuentes,
contraste, clics) + **juez GPT-5.6 Sol** con rúbrica (craft + mérito
anti-slop + escala + mini-rúbrica del hero) + máx 1 re-prompt quirúrgico
(economía de tokens). **Fase C** después: bake-off de jueces contra el ojo
del owner, golden examples, perfil de gusto, telemetría.
