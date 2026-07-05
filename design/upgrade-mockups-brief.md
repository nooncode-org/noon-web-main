# Brief — Mockups "Antes / Después" para la sección *Upgrade* de Noon

> Documento autocontenido para pasar a un asistente de IA (Gemini / ChatGPT) sin contexto previo.
> **Se adjunta por separado una imagen de referencia** del diseño "DESPUÉS" (tienda de muebles "minim").

---

## 0. Resumen de lo que pido

Construir **DOS páginas web HTML independientes, autocontenidas e interactivas**:

1. **ANTES** — la versión *anticuada / recargada* de una tienda online ficticia.
2. **DESPUÉS** — la versión *moderna, minimal y premium* de **la misma tienda** (mismos productos, misma marca), al estilo de la imagen de referencia adjunta.

Ambas son **mockups de demostración**: van a mostrarse una al lado de la otra para ilustrar visualmente el "antes y después" de rediseñar un sitio web. No son sitios reales; el contenido puede inventarse, pero debe verse **realista y profesional** (nada de *lorem ipsum*, nada de imágenes rotas).

---

## 1. Contexto (para entender el objetivo)

- **Noon** es un estudio de desarrollo de software y productos con IA.
- Uno de sus servicios se llama **"Upgrade"**: el cliente pega la URL de su sitio actual, una IA lo audita y lo **reconstruye como una versión mejorada** en código real y mantenible. En pocas palabras: *"tomamos tu sitio flojo/anticuado y lo dejamos así de bien."*
- En la página de ese servicio queremos poner **estos dos mockups** al lado del formulario, para que el visitante **vea** la transformación de un vistazo (un sitio viejo → un sitio pulido).
- Por eso los dos mockups deben ser **la misma tienda**: mismo nombre, mismos productos, mismos precios. Solo cambia el **diseño/época**. Así se lee como una transformación 1:1, no como dos sitios distintos.

**Importante:** estos mockups son de una **tienda de muebles ficticia**, NO son la web de Noon. No apliques ninguna identidad de Noon; el estilo del "DESPUÉS" sale de la imagen de referencia adjunta.

---

## 2. La referencia del "DESPUÉS" (imagen adjunta)

Es una tienda online de **muebles y decoración** minimalista y premium:

- Mucho **espacio en blanco**, layout aireado y ordenado.
- Paleta **terrosa y suave**: fondo crema / off-white, **verde salvia** como acento, tonos **madera**, gris carbón para el texto.
- Tipografía limpia con jerarquía clara (sans moderna).
- Estructura: **hero** con un producto destacado grande + paginación (dots 01/02) → grilla de **"Recent Products"** → sección de **testimonios** → **footer** con newsletter e íconos de métodos de pago.
- Sensación general: elegante, calmada, cara, tipo tienda escandinava.

---

## 3. El entregable: 2 archivos HTML

### 3.1 Reglas comunes (¡la misma tienda en ambos!)
- Mismo **nombre de tienda**, mismo **catálogo de productos**, mismos **precios**, mismos **textos base**.
- Lo único que cambia entre ANTES y DESPUÉS es el **diseño** (layout, tipografía, color, espaciado, calidad visual).
- **8–12 productos** en la grilla. Cada uno: nombre, categoría, precio, y opcional rating/estrellas y badge ("Sale"/"New").

### 3.2 Spec "DESPUÉS" (el bueno)
Replica el espíritu de la referencia:
- Hero: producto destacado grande, titular corto, botón "Shop this product", paginación 01/02.
- Grilla "Recent Products" limpia (3–4 columnas), imágenes con aire, hover sutil.
- Testimonios (3–4).
- Footer minimal: logo, newsletter, íconos de pago.
- Paleta crema/salvia/madera/carbón, sans moderna, mucho whitespace, bordes casi invisibles.

### 3.3 Spec "ANTES" (el malo, pero creíble)
La misma tienda pero **auténticamente anticuada** (estética ~2008–2013), no una caricatura:
- Layout **apretado**, sin aire, todo pegado.
- **Bordes** y **sombras/degradados** por todas partes; cajas dentro de cajas.
- **Colores duros/saturados** que chocan (azul eléctrico + rojo + amarillo), fondos con textura.
- **Tipografía inconsistente** (mezcla tipo Arial + Times), tamaños desparejos, texto centrado sin criterio.
- Grilla **densa** de productos con imágenes chicas y bordes.
- Nav **sobrecargado** con demasiados ítems; un **banner "SALE!!!"** o cintillo promocional parpadeante.
- **Botones biselados** noventeros, quizá un "contador de visitas" o "Best viewed in 1024×768".
- Debe verse feo **pero funcional y coherente** — como muchos sitios viejos reales.

---

## 4. Requisitos técnicos (críticos)

- **Cada mockup = un solo archivo `.html` autocontenido**: todo el CSS y el JS **inline** (dentro del propio archivo). Debe poder abrirse haciendo doble clic, sin servidor.
- **CERO dependencias externas**: nada de CDNs, Google Fonts remotas, librerías por URL, ni imágenes hospedadas fuera. (Se van a incrustar en un entorno sandbox que bloquea todo lo externo.)
  - Fuentes: usa **web-safe** (system-ui, Georgia, Arial, etc.) o embebidas en base64.
  - Íconos: **SVG inline**.
- **Responsive** (que no se rompa en móvil), aunque el foco es desktop.
- **Interactivo pero acotado** (sin backend): hover en productos, nav clickeable (visual), el switcher del hero (dots 01/02), un contador de carrito que sube al hacer "add". Nada más.

---

## 5. Contenido a generar (realista y profesional)

Puedes **inventar** todo esto, pero que sea creíble y consistente entre ambos mockups:
- **Marca:** nombre de la tienda + tagline corto + un wordmark simple (texto/SVG).
- **Catálogo:** 8–12 productos de muebles/decoración con nombre, categoría, precio y (opcional) rating/badge.
- **Hero:** producto destacado + titular + subtítulo + CTA.
- **Testimonios:** 3–4 con nombre, cita breve y rol/ubicación.
- **Nav / Footer / Newsletter:** ítems de menú, enlaces de footer, copy del newsletter, copyright.
- **Moneda:** usa una realista (USD recomendado) — la misma en ambos.

---

## 6. Imágenes de producto (importante por el sandbox)

Como no se permiten imágenes externas, para los productos usa **ilustraciones SVG inline limpias** o formas CSS que representen cada mueble (silla, mesa, reloj, lámpara, jarrón…).
- **Deben ser los mismos productos** en ambos mockups (misma silla, misma mesa…), solo presentados según cada época: en el DESPUÉS grandes y con aire; en el ANTES chicas, con borde y peor encuadre.
- Consistencia de estilo dentro de cada versión.
- (Opcional: se podrán sustituir luego por fotos reales incrustadas en base64.)

---

## 7. Decisiones abiertas (elige tú o propón 2–3 opciones)

- **Nombre e identidad** de la tienda ficticia (o inventa uno bueno).
- **Idioma** de los mockups: inglés o español.
- **Qué tan "feo"** el ANTES: sutilmente anticuado vs. abiertamente noventero.
- Set exacto de productos y precios.

---

## 8. Qué NO hacer

- ❌ Nada de *lorem ipsum* ni texto de relleno genérico.
- ❌ Nada de imágenes externas, `placeholder.com`, `via.placeholder`, ni `src` rotos.
- ❌ Nada de CDNs, `<link>`/`<script>` a URLs externas, Google Fonts remotas.
- ❌ No aplicar branding de Noon — es una tienda de muebles independiente.
- ❌ El ANTES no debe ser un chiste ilegible; feo pero coherente y funcional.

---

## 9. Formato de entrega esperado

Devuelve **dos bloques de código completos**, cada uno un archivo `.html` autocontenido y listo para abrir:
1. `tienda-antes.html`
2. `tienda-despues.html`

Y una breve nota de las decisiones que tomaste (nombre de la tienda, idioma, lista de productos) para poder replicarlas o ajustarlas.
