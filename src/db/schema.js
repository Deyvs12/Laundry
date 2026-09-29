export const schema = `
  CREATE TABLE IF NOT EXISTS Users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT CHECK(role IN ('admin', 'employee')) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS Clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    notes TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS Services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('laundry', 'ironing', 'dry_cleaning')) NOT NULL,
    price REAL NOT NULL,
    price_type TEXT CHECK(price_type IN ('kilo', 'unit', 'service')) NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS Staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS Cash_shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    opening_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    closing_time DATETIME,
    initial_cash REAL NOT NULL,
    expected_cash REAL DEFAULT 0,
    actual_cash REAL,
    difference REAL,
    status TEXT CHECK(status IN ('open', 'closed')) DEFAULT 'open',
    closed_by INTEGER,
    FOREIGN KEY (user_id) REFERENCES Users(id),
    FOREIGN KEY (closed_by) REFERENCES Users(id)
  );

  CREATE TABLE IF NOT EXISTS Orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_client INTEGER NOT NULL,
    id_user INTEGER NOT NULL,
    id_staff INTEGER,
    status TEXT CHECK(status IN ('received', 'in_process', 'ready', 'delivered', 'cancelled')) DEFAULT 'received',
    discount REAL DEFAULT 0,
    total REAL DEFAULT 0,
    paid INTEGER DEFAULT 0,
    payment_day DATETIME,
    payment_method TEXT CHECK(payment_method IN ('cash', 'transfer')),
    cash_shift_id INTEGER,
    notes TEXT,
    expected_delivery_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_client) REFERENCES Clients(id),
    FOREIGN KEY (id_user) REFERENCES Users(id),
    FOREIGN KEY (id_staff) REFERENCES Staff(id),
    FOREIGN KEY (cash_shift_id) REFERENCES Cash_shifts(id)
  );

  CREATE TABLE IF NOT EXISTS Order_services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_orders INTEGER NOT NULL,
    id_services INTEGER NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    sub_total REAL NOT NULL,
    status TEXT CHECK(status IN ('in_process', 'ready')) DEFAULT 'in_process',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_orders) REFERENCES Orders(id),
    FOREIGN KEY (id_services) REFERENCES Services(id)
  );

  CREATE TABLE IF NOT EXISTS Cash_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT CHECK(type IN ('refund', 'withdrawal', 'deposit', 'expense')) NOT NULL,
    method TEXT CHECK(method IN ('cash', 'transfer')) NOT NULL,
    amount REAL NOT NULL,
    order_id INTEGER,
    cash_shift_id INTEGER,
    user_id INTEGER NOT NULL,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES Orders(id),
    FOREIGN KEY (cash_shift_id) REFERENCES Cash_shifts(id),
    FOREIGN KEY (user_id) REFERENCES Users(id)
  );

  CREATE TABLE IF NOT EXISTS Logs (
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
      'ORDER_REFUNDED',
      'ORDER_EDITED',
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
  );
`
