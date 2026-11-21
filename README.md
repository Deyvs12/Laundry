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
├── printer/          tickets: PC850, ESC/POS, 32 columnas y cola de impresión
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

## Impresora de tickets

Térmica **SNBC BTP-R356H**, de 58 mm y conectada por USB. Linux la maneja con
el driver `usblp` del kernel, sin CUPS ni drivers adicionales. El sistema le
escribe ESC/POS directamente al dispositivo.

La instalación en la computadora del cliente se hace una sola vez, en tres
pasos.

### 1. Poner la impresora en modo clase (una vez, desde Windows)

De fábrica viene en *API Mode* (USB `154f:154f`, clase 255). En ese modo Linux
no la reconoce como impresora y no aparece ningún `/dev/usb/lp*`.

Se cambia con **BarPrnTest** de SNBC: *Herramientas → Configuración del
dispositivo → Modo USB: API → Clase*. El ajuste se queda guardado en la
impresora. Después debe aparecer como `154f:1300`:

```bash
lsusb | grep 154f        # debe decir 154f:1300
```

### 2. Regla udev para un nombre fijo

El kernel la crea como `/dev/usb/lp0`, `lp1`, etc., y ese número puede cambiar
entre reinicios o si se conecta otra impresora. La regla le da siempre el mismo
nombre, `/dev/ticketera`:

```bash
sudo tee /etc/udev/rules.d/99-ticketera.rules > /dev/null <<'EOF'
SUBSYSTEM=="usbmisc", KERNEL=="lp*", SUBSYSTEMS=="usb", ATTRS{idVendor}=="154f", ATTRS{idProduct}=="1300", GROUP="lp", MODE="0660", SYMLINK+="ticketera"
EOF

sudo udevadm control --reload-rules
sudo udevadm trigger
```

Para comprobarla, con la impresora conectada y encendida:

```bash
ls -l /dev/ticketera     # enlace a usb/lp0 (o lpN)
ls -l /dev/usb/lp*       # dueño root:lp, permisos crw-rw----
```

La regla sigue funcionando si se apaga y se enciende la impresora (probado).

### 3. Permiso para el usuario que corre el servidor

El dispositivo pertenece al grupo `lp`. Si el usuario que ejecuta el servidor
no está en ese grupo, imprimir falla con *permiso denegado*:

```bash
sudo usermod -aG lp "$USER"
```

El grupo nuevo solo lo reciben los procesos que arrancan después del cambio.
**Hay que reiniciar la computadora.** Cerrar sesión y volver a entrar no siempre
basta: el administrador de sesión del usuario (`systemd --user`) puede seguir
vivo, y los programas que lanza, como el editor o la terminal, heredan los
grupos viejos.

Para comprobarlo, en una terminal nueva:

```bash
id -nG                   # tiene que aparecer lp
```

Si `/etc/group` ya lo incluye (`getent group lp`) pero `id` no, el proceso
viene de antes del cambio. Mientras tanto se puede probar con
`sg lp -c "bun run scripts/print-test.js"`.

### 4. Datos del negocio en los tickets

El encabezado y el pie de cada ticket salen de un archivo `.env` en la raíz
del proyecto. Bun lo lee solo al arrancar y no se sube a git.

```bash
LAVANDERIA_NEGOCIO="Lavandería La Burbuja"
LAVANDERIA_DIRECCION="Av. Juárez 123|Col. Centro, Chihuahua"
LAVANDERIA_TELEFONO="614 123 4567"
LAVANDERIA_PIE_TICKET="¡Gracias por su preferencia!|Sin ticket no se entrega ropa"
```

En dirección y pie, `|` separa renglones. Una variable vacía simplemente no se
imprime. Los cambios se aplican al reiniciar el servidor. En `/printer` se ve
lo que va a salir y se avisa si falta algún dato.

Ojo: Bun busca el `.env` en la carpeta desde donde se arranca. Si algún día
corre como servicio de systemd, conviene apuntarlo explícitamente con
`EnvironmentFile=/ruta/al/proyecto/.env`.

### Comprobar que imprime

Desde la terminal, sin levantar el servidor:

```bash
bun run scripts/print-test.js
```

O desde la aplicación, en `/printer` (no aparece en la barra; se teclea la
dirección). Las dos opciones imprimen el mismo ticket de prueba: acentos, una
regla de 32 columnas y renglones con precio. Si falta algún carácter, o se
pierde el que va después de una ñ o una ¿, la secuencia de inicio no está
llegando a la impresora (ver `src/printer/escpos.js`).

Si algo falla, el mensaje dice la causa: impresora no encontrada (desconectada
o apagada), sin permiso (paso 3), ocupada por otro programa, o sin respuesta
(sin papel o con la tapa abierta). Una impresión nunca deja colgado el
sistema: después de 10 segundos sin respuesta se cancela.

## Variables de entorno

| Variable | Por defecto | Para qué |
|---|---|---|
| `LAVANDERIA_DB` | `lavanderia.db` en la raíz | Apuntar a otra base (pruebas, restaurar un respaldo) |
| `LAVANDERIA_BACKUPS` | `backups/` junto a la base | Cambiar la carpeta de respaldos |
| `LAVANDERIA_TICKETERA` | `/dev/ticketera` | Dispositivo de la impresora de tickets |
| `LAVANDERIA_NEGOCIO`, `LAVANDERIA_DIRECCION`, `LAVANDERIA_TELEFONO`, `LAVANDERIA_PIE_TICKET` | vacías | Encabezado y pie de los tickets (ver *Impresora de tickets*, paso 4) |
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
