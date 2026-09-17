// Migraciones incrementales sobre PRAGMA user_version.
//
// schema.js crea la forma actual de las tablas en una DB nueva (CREATE TABLE
// IF NOT EXISTS). Este archivo se encarga de las DB que ya existen y se
// quedaron con una forma vieja: SQLite no vuelve a tocar una tabla ya creada.
//
// Cada `up` debe ser defensivo (comprobar antes de actuar) porque también se
// ejecuta sobre DB recién creadas, donde el cambio ya viene aplicado.
//
// Regla: una migración publicada NO se edita nunca. Para corregir algo, se
// agrega una nueva con el siguiente número de versión.

function hasColumn(db, table, column) {
  return db
    .query(`PRAGMA table_info(${table})`)
    .all()
    .some((c) => c.name === column)
}

function tableSql(db, table) {
  const row = db
    .query(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(table)
  return row?.sql || ''
}

// SQLite no permite modificar un CHECK con ALTER TABLE: hay que reconstruir la
// tabla entera y copiar los datos. Este es el DDL de Logs congelado en v1.
function rebuildLogs(db) {
  db.exec(`
    CREATE TABLE Logs_v1 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      order_id INTEGER,
      cash_shift_id INTEGER,
      action TEXT CHECK(action IN (
        'ORDER_CREATED',
        'ORDER_STATUS_CHANGED',
        'ORDER_DISCOUNTED',
        'ORDER_PAID',
        'ORDER_CANCELLED',
        'SHIFT_OPENED',
        'SHIFT_CLOSED',
        'USER_LOGIN',
        'USER_LOGOUT'
      )) NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES Users(id),
      FOREIGN KEY (order_id) REFERENCES Orders(id),
      FOREIGN KEY (cash_shift_id) REFERENCES Cash_shifts(id)
    )
  `)

  db.exec(`
    INSERT INTO Logs_v1 (id, user_id, order_id, cash_shift_id, action, message, created_at)
    SELECT id, user_id, order_id, cash_shift_id, action, message, created_at FROM Logs
  `)

  db.exec('DROP TABLE Logs')
  db.exec('ALTER TABLE Logs_v1 RENAME TO Logs')
}

const migrations = [
  {
    version: 1,
    name: 'Orders.discount, Orders.cash_shift_id y Logs.ORDER_DISCOUNTED',
    up(db) {
      // Descuento global del pedido: total = SUM(sub_total) - discount.
      if (!hasColumn(db, 'Orders', 'discount')) {
        db.exec('ALTER TABLE Orders ADD COLUMN discount REAL DEFAULT 0')
      }

      // Liga el cobro al turno de caja en el que ocurrió. Sin esto habría que
      // inferirlo comparando payment_day contra el rango del turno, que se
      // rompe con turnos sin cerrar o dos turnos el mismo día.
      if (!hasColumn(db, 'Orders', 'cash_shift_id')) {
        db.exec(
          'ALTER TABLE Orders ADD COLUMN cash_shift_id INTEGER REFERENCES Cash_shifts(id)'
        )
      }

      if (!tableSql(db, 'Logs').includes('ORDER_DISCOUNTED')) {
        rebuildLogs(db)
      }
    }
  },
  {
    version: 2,
    name: 'Cash_shifts.closed_by',
    up(db) {
      // user_id es quien abre. El dueño deja encargado a un empleado y cierra
      // él por la noche: hay que saber quién hizo cada cosa.
      if (!hasColumn(db, 'Cash_shifts', 'closed_by')) {
        db.exec('ALTER TABLE Cash_shifts ADD COLUMN closed_by INTEGER REFERENCES Users(id)')
      }
    }
  }
]

function currentVersion(db) {
  return db.query('PRAGMA user_version').get().user_version
}

export function runMigrations(db) {
  const from = currentVersion(db)

  for (const migration of migrations) {
    if (migration.version <= from) continue

    // Reconstruir tablas con las FK activas puede poner a NULL referencias
    // ajenas al hacer DROP. El PRAGMA es no-op dentro de una transacción, así
    // que va fuera. La versión se sella dentro de la misma transacción que el
    // cambio, para que no puedan quedar desincronizados.
    db.exec('PRAGMA foreign_keys = OFF')
    try {
      db.transaction(() => {
        migration.up(db)
        db.exec(`PRAGMA user_version = ${migration.version}`)
      })()
    } finally {
      db.exec('PRAGMA foreign_keys = ON')
    }

    console.log(`[migrate] v${migration.version} — ${migration.name}`)
  }
}
