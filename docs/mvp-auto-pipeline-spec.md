# Pipeline automático de MVP — spec de decisiones (2026-08-01)

> Decidido punto por punto con el owner en la sesión del 2026-08-01, tras
> investigar cómo lo hacen Base44, Emergent (E3), Replit (Agent 3), Lovable y
> Bolt. **La obra vive en el App** (repo `nooncode-app`); este documento es el
> registro de coordinación desde el sitio web, que ya está listo (handoff
> `payment-confirmed`, estados del portal, poll de progreso).

## La visión

Al confirmarse el pago, la IA (Opus etc.) completa el MVP desde el prototipo
aprobado — deja de ser prototipo y pasa a app funcional —, lo despliega en el
**Vercel de Noon** y crea su base de datos en el **Supabase de Noon**, como
**proyectos independientes nombrados por cliente**. El cliente lo sigue en su
portal; el one-time puede exportar código y datos; la membresía, sus datos.

## Las 10 decisiones (cerradas)

1. **Dónde vive el pipeline → en el App.** El App ya es dueño de los proyectos
   (recibe `payment-confirmed`, crea `projectId`, publica/despublica). El sitio
   solo vende y muestra. Un solo cerebro.

2. **Runner → GitHub Actions.** El App dispara un workflow por API al
   confirmarse el pago; corre hasta 6h con logs/reintentos/secretos incluidos.
   Cero infraestructura nueva; GitHub ya está en el stack por los repos por
   cliente (punto 6).

3. **Plantilla base → una sola: Next.js + Supabase** (auth + RLS + seed de
   demo listos). La IA genera solo lo del cliente encima de una base que ya
   construye y despliega. Kits por categoría como evolución cuando el volumen
   lo pida — nunca stack libre por proyecto.

4. **Supabase → plan Pro por proyecto desde el día 0** (~$10/mes por proyecto;
   cuadra con el cálculo de $120/año del hosting). El MVP se genera después de
   pagar, así que cada proyecto tiene una venta detrás. Free tier inviable
   (máx. 2 proyectos activos, se pausa a ~7 días).

5. **Naming → slug = nombre + id corto de sesión** (`tienda-ropa-k3f9`),
   idéntico en Vercel, Supabase y GitHub. Lo decide el pipeline, nunca una
   persona.

6. **Código del cliente → repo privado por proyecto en la org GitHub de Noon.**
   El one-time recibe invitación de lectura + download (zip del release)
   **al estar entregado** — durante el build sigue el progreso por el portal,
   no por el taller a medio hacer.

7. **Aislamiento y secretos (3 reglas duras):**
   - Cada proyecto ve **solo sus claves** (env de su Vercel; keys de su Supabase).
   - Los tokens maestros (admin Vercel/Supabase/org GitHub) viven **solo en los
     secrets del runner**.
   - **El código generado por la IA jamás recibe tokens maestros** — solo las
     claves de su propio proyecto.

8. **Gate final → automático desde el día 1, con verificación agéntica.**
   Sin humano bloqueante (el factor tiempo es la ventaja frente a Base44).
   El proceso de calidad completo, abajo.

9. **Fallos → 5 intentos de auto-arreglo + alerta.** Al agotarse: alerta al
   equipo (correo/Slack), el portal se queda "in development" con actividad —
   el cliente nunca ve un error. Tope de tokens por MVP configurable como
   límite de gasto duro.

10. **Puente hasta que exista → arranque manual.** El equipo inicia el build al
    recibir el correo de pago (ya existe). La promesa de la página ("the AI
    begins generating it the moment payment clears") se cumple a mano con
    volumen bajo; el pipeline solo sustituye el disparador humano.

## El proceso de calidad (punto 8, en detalle)

Síntesis de lo mejor de cada plataforma investigada; mandato del owner:
"el proceso más completo y seguro para entregar calidad de verdad".

**Construcción por fases** *(Emergent E3)* — cada entregable del alcance es una
fase; se testea antes de avanzar. Nunca generación monolítica.

- **Capa 1 — gates mecánicos:** typecheck + lint + build de producción +
  migraciones aplican en limpio + seed corre + el server arranca y las rutas
  clave responden 200 (no solo compilar: correr).
- **Capa 2 — tests tradicionales:** la plantilla trae suite base (auth, CRUD)
  que la IA extiende por entregable; corren en el CI del repo del proyecto.
- **Capa 3 — tester agéntico con navegador real** *(Replit Agent 3)*:
  subagente SEPARADO (contexto propio, no contamina al builder) con Playwright
  en modo "code-use". **El plan de test es el alcance numerado de la
  propuesta** — ventaja estructural de Noon: Maxwell ya produce la checklist.
  Cada flujo se ejercita como usuario real; verificación **anti-Potemkin**:
  el efecto debe aparecer en la base de datos (query real), consola y red sin
  errores. Login/signup siempre en el plan. Coste esperado ~$0.20–1/sesión.
- **Capa 4 — bucle de arreglo** *(Lovable, corregido)*: fallo → reporte
  estructurado (paso, error, logs) al builder → arreglo de **causa raíz** y
  re-pasa la capa 3 ENTERA (prohibido parche-sobre-parche, la debilidad
  conocida de Bolt). 5 intentos (punto 9) → alerta.
- **Capa 5 — publicación + QA humano asíncrono:** verde total → deploy + Live
  en el portal. El equipo recibe el reporte completo (tests pasados, capturas,
  coste) y revisa en horas hábiles; los ajustes salen como actualizaciones por
  el flujo de correcciones existente. El cliente ve la v1 como "MVP" con botón
  de pedir cambios — el producto absorbe la imperfección como iteración.

**Métrica de guardia:** % de MVPs publicados sin intervención humana posterior.
Si baja, se recalibra el tester (más flujos, más asserts), no se añade un
humano bloqueante.

## Qué necesita el sitio web (este repo)

Nada nuevo. Ya existen: handoff `payment-confirmed` → App
(`lib/noon-app-integration.ts`), estados del portal
(in_preparation/in_development/delivered + Live), poll de progreso y el flujo
de correcciones. Cuando el pipeline exista, sustituye al disparador humano sin
tocar el sitio.

## Fuentes de la investigación

- Replit — [Enabling Agent 3 to Self-Test at Scale](https://replit.com/blog/automated-self-testing)
  (verificación REPL+Playwright, "interfaces Potemkin", ~$0.20/sesión, tester
  como subagente) y [App Testing](https://docs.replit.com/core-concepts/agent/app-testing).
- Emergent — [Introducing E3](https://emergent.sh/blog/introducing-e-3-autonomous-app-building-on-emergent)
  (fases con test antes de avanzar, dos capas de testing, enrutado de fixes).
- Base44 — [AI App Builder](https://base44.com/ai-app-builder) (stack cerrado
  gestionado; el usuario en vivo como revisor).
- Lovable/Bolt — [guía de errores](https://www.appstuck.com/blog/bolt-new-not-working-fix-the-10-most-common-errors-2026)
  (auto-fix por logs; debilidad parche-sobre-parche).
