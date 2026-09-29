# Sistema de diseño

Guía de la interfaz. **Antes de escribir una pantalla nueva, lee esto.**

La regla que resume todo: **ninguna vista escribe colores ni tamaños sueltos**.
Si necesitas un botón, un campo, un distintivo o un aviso, lo pides a
`src/views/components.js`. Si necesitas un color, ya existe con nombre en
`public/css/main.css`. Si no existe, se agrega ahí y se usa por su nombre.

Dónde vive cada cosa:

| Archivo | Qué contiene |
|---|---|
| `public/css/main.css` | Tokens de color y clases de componentes (`.btn`, `.input`, `.card`, `.badge`) |
| `src/views/components.js` | Funciones que arman el HTML de esas piezas |
| `src/views/layout.js` | Cáscara de la aplicación: barra de navegación y avisos globales |

---

## Para quién es esta interfaz

Una persona de pie en un mostrador, con un cliente enfrente esperando, a veces
con las manos ocupadas. Eso manda sobre cualquier consideración estética:

- **Lo frecuente va primero.** La portada es la captura de pedidos, no un panel
  de bienvenida. Registrar un pedido es lo que se hace cien veces al día.
- **Nada se toca dos veces.** Un servicio se agrega con un solo toque, no
  eligiéndolo y luego pulsando "Agregar".
- **Nada oculto detrás de menús.** Las ocho secciones están siempre visibles.
- **Los errores se explican en el sitio donde ocurren**, nunca con una pantalla
  que no cambia y deja al usuario sin saber qué pasó.

---

## Color

### Marca

Verde azulado (`brand`). Es agua limpia: fresco sin ser frío ni clínico, que es
justo lo que un azul puro o un gris habrían transmitido. Se usa para acciones
principales, el enlace activo de la barra y el total del pedido.

Los tonos útiles en la práctica son **600** para fondos de acción, **700** para
texto sobre blanco, y **50 / 100** para fondos suaves.

### Fondo

`--color-canvas` es un gris muy claro con una gota de azul. Las tarjetas van en
blanco puro, así que destacan encima como ropa limpia sobre la mesa. Nunca se
pone contenido directamente sobre el fondo sin una tarjeta.

### Estado

El color comunica urgencia, y esto es lo más importante de toda la guía: quien
mira la lista de pedidos debe saber qué hacer **sin leer**.

| Estado | Tono | Significado |
|---|---|---|
| Recibido | gris | Nadie lo ha tocado |
| En proceso | ámbar | Hay trabajo pendiente |
| Listo | verde | El cliente ya puede venir |
| Entregado | marca | Cerrado bien |
| Cancelado | rojo | Cerrado mal |

Lo mismo para el pago: pendiente en ámbar, pagado en verde, devuelto en rojo.

Nunca se usa el color como única señal. Siempre lleva texto al lado.

---

## Tipografía y espacio

Se usa la del sistema, que en Debian se ve bien y no cuesta una descarga.

- Título de pantalla: `text-2xl font-semibold`
- Título de tarjeta: `font-semibold`
- Texto normal: `text-sm`
- Apoyo y pistas: `text-xs text-slate-500`
- **Cifras de dinero: siempre `tabular-nums`**, para que las columnas de precios
  queden alineadas verticalmente.

El espaciado se mueve en múltiplos de 4px. Entre tarjetas van 20px (`gap-5`);
dentro de una tarjeta, 16px en móvil y 20px en pantalla grande.

---

## Tamaño táctil

**Nada que se toque mide menos de 44px de alto.** Está en el token
`--spacing-touch` y lo aplican `.btn`, `.input` y `.pick-row`.

La única excepción son los iconos secundarios dentro de una fila, como el bote
de basura para quitar una línea, que miden 32px porque van acompañados de
espacio libre alrededor.

---

## Adaptación a pantallas

Se diseña primero para **tablet**, que es el caso real de uso.

| Ancho | Comportamiento |
|---|---|
| Menos de 640px | Una columna. Los filtros se apilan |
| 640 a 1024px | Una columna, filtros en fila. Tablet vertical |
| 1024px o más | Dos columnas en la captura, resumen pegajoso |

La barra de navegación no se colapsa nunca en un menú de hamburguesa: las
secciones se deslizan horizontalmente si no caben. En una app de mostrador, un
menú oculto es un toque de más en cada uso.

Las tablas anchas se envuelven en `tableWrap()`, que permite deslizarlas sin
romper la página.

---

## La pantalla de captura

Sigue la disposición de un punto de venta, y conviene entender por qué:

```
┌──────────────────────────┬─────────────────────┐
│  1. Cliente              │   Resumen           │
│     buscar / crear       │   ─────────         │
│                          │   líneas del pedido │
│  2. Servicios            │   descuento         │
│     tipo · buscar · cant │   TOTAL             │
│     ┌────────────────┐   │   ─────────         │
│     │ resultado    + │   │   entrega           │
│     │ resultado    + │   │   atendió           │
│     └────────────────┘   │   notas             │
│                          │   [ Crear pedido ]  │
└──────────────────────────┴─────────────────────┘
      se busca y se arma        se revisa y confirma
```

La columna derecha queda pegada al desplazarse, así que **el total siempre está
a la vista** mientras se agregan servicios. Es la diferencia entre capturar a
ciegas y ver crecer la cuenta, que es lo que el cliente pregunta.

En tablet vertical y en teléfono se apila en ese mismo orden, que es el orden
natural de la conversación en el mostrador.

---

## Componentes disponibles

De `src/views/components.js`:

**Estructura**: `pageHeader({ title, subtitle, actions })`, `card({ title, action, body, pad })`

**Acciones**: `btn({ label, variant, size, attrs, iconName, block })` con
variantes `primary`, `secondary`, `danger`, `ghost` y tamaños `sm`, `md`, `lg`.
`linkBtn({ ... })` es lo mismo pero navega.

**Formularios**: `field({ label, name, type, value, attrs, hint })`,
`selectField({ label, name, options, selected, placeholder })`

**Estado**: `badge(label, tone)`, `orderStatusBadge(status)`,
`lineStatusBadge(status)`, `paymentBadge(order)`

**Mensajes**: `alert({ tone, message, title })` con tonos `info`, `success`,
`warning`, `danger`. `emptyState({ title, message, action, iconName })`

**Datos**: `dataRow(label, value)`, `tableWrap(html)`

**Iconos**: `icon(name, className)`. Hay trece, de trazo. Devuelve cadena vacía
si el nombre no existe, para que un error de tecleo no rompa la página.

---

## Cosas que no se hacen

- Escribir `bg-blue-500` o cualquier color suelto en una vista.
- Poner texto directamente sobre el fondo de la página, sin tarjeta.
- Usar solo color para comunicar un estado.
- Botones de menos de 44px.
- Esconder acciones frecuentes detrás de un menú.
- Devolver un error con código HTTP de error a HTMX: **no pinta nada**. Se
  responde con código normal y el mensaje dentro del fragmento.

---

## Al agregar una pantalla

1. `pageHeader()` arriba.
2. El contenido dentro de `card()`.
3. Campos con `field()` y `selectField()`, nunca `<input>` a pelo.
4. Estados con los distintivos, nunca texto plano.
5. Listas vacías con `emptyState()`, no con una celda que diga "sin datos".
6. Comprobar a 768px de ancho antes de darla por terminada.
