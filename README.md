# Laundry

Sistema de gestión para una lavandería, planchaduría y tintorería.
Corre en la PC del local y se usa desde el navegador, también desde otros
equipos de la red local.

## Qué hace

- **Pedidos**: captura con búsqueda de cliente y de servicios, descuento,
  fecha de entrega y quién atendió. Ciclo de vida completo: recibido, en
  proceso, listo, entregado o cancelado.
- **Clientes** y **catálogo de servicios** (lavandería, planchado, tintorería;
  precio por kilo, por prenda o por servicio).
- **Personal**: las personas que atienden el mostrador. Se eligen al crear un
  pedido para saber quién lo registró. No inician sesión.
- **Caja**: apertura con fondo inicial, cobros ligados al turno, cierre con
  arqueo y diferencia. Las devoluciones se restan del esperado.
- **Reportes**: ingresos netos por día, semana o mes, por tipo de servicio, por
  forma de pago y clientes que más compraron.
- **Bitácora**: registro automático de todo evento relevante, con filtros.
- **Respaldo** de la base de datos desde la propia aplicación.

## Requisitos

Solo [Bun](https://bun.com). SQLite viene incluido en Bun, no se instala aparte.

## Arranque

```bash
bun install
bun run css     # compila Tailwind en modo watch (dejar corriendo aparte)
bun run dev     # servidor en el puerto 3000
```

La primera vez se crea la base de datos y un usuario administrador:

```
usuario: admin
contraseña: admin123
```

> **Cambia esa contraseña antes de poner el sistema en uso.** Mientras siga la
> de fábrica, la aplicación muestra un aviso rojo permanente. Se cambia en
> **Mi cuenta**, en la esquina superior derecha.

## Pruebas

```bash
bun test
```

Las pruebas usan una base de datos temporal distinta en cada ejecución
(`test/_setup.js`); nunca tocan `lavanderia.db`.

## Estructura

```
src/
├── index.js          arranque del servidor y montaje de rutas
├── constants.js      valores permitidos por los CHECK del schema, con etiquetas
├── money.js          redondeo a 2 decimales, en un solo lugar
├── render.js         páginas completas (inyecta usuario y estado de caja)
├── routes/           endpoints HTTP
├── controllers/      validación y decisión de qué vista devolver
├── services/         acceso a datos y reglas de negocio
├── views/            plantillas HTML (fragmentos para HTMX)
├── middleware/       autenticación
└── db/
    ├── database.js   conexión, PRAGMA y arranque de migraciones
    ├── schema.js     forma actual de las tablas (para bases nuevas)
    ├── migrations.js cambios incrementales (para bases que ya existen)
    └── seed.js       usuario administrador inicial
```

El servidor **siempre devuelve HTML**, nunca JSON. HTMX inserta los fragmentos
en la página sin recargarla. La única excepción es la descarga de un respaldo,
que es un archivo.

## Base de datos

`lavanderia.db`, en la raíz del proyecto. Está en `.gitignore`.

Los cambios de estructura se aplican solos al arrancar, mediante migraciones
numeradas con `PRAGMA user_version`. **Una migración ya publicada no se edita
nunca**: para corregir algo se agrega la siguiente.

Las fechas con hora se guardan en UTC y se convierten a hora local al mostrarse.
Toda consulta que agrupe por día debe usar `date(columna, 'localtime')`.

## Respaldos

Desde **Reportes**, al pie, con el botón *Crear respaldo ahora*. Usa
`VACUUM INTO`, que produce una copia consistente aunque la base esté en uso.

Los archivos van a `backups/` y se pueden descargar desde la misma pantalla.
Conviene copiar uno a una memoria USB cada tanto: un respaldo en el mismo disco
que la base no protege contra una falla del disco.

## Variables de entorno

| Variable | Por defecto | Para qué |
|---|---|---|
| `LAVANDERIA_DB` | `lavanderia.db` en la raíz | Apuntar a otra base (pruebas, restaurar un respaldo) |
| `LAVANDERIA_BACKUPS` | `backups/` junto a la base | Cambiar la carpeta de respaldos |
| `SESSION_HOURS` | `8` | Horas de inactividad antes de cerrar la sesión |
| `TZ` | la zona del sistema | Zona horaria del negocio |

Sobre `TZ`: el sistema calcula la fecha de hoy en dos lugares, en JavaScript y
en SQL con `date(..., 'localtime')`. Si esos dos relojes no usan la misma zona,
los reportes y los cortes de caja salen corridos un día. Al arrancar se
comprueba que coincidan y el servidor **se niega a iniciar** si no es así, en
lugar de producir cifras equivocadas en silencio.

Normalmente no hay que tocar nada. Si algún día se ejecuta como servicio de
systemd, conviene declararlo explícitamente:

```ini
Environment=TZ=America/Mexico_City
```
