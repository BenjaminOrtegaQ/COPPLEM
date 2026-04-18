PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;

/* ===================== Tablas base ===================== */
CREATE TABLE IF NOT EXISTS negocio (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre           TEXT NOT NULL,
  rut              TEXT,
  giro             TEXT,
  direccion        TEXT,
  comuna           TEXT,
  ciudad           TEXT,
  region           TEXT,
  telefono         TEXT,
  moneda           TEXT NOT NULL DEFAULT 'CLP',
  iva_por_defecto  NUMERIC,

  -- Defaults globales para alertas de productos
  alerta_stock_minimo_default       NUMERIC,
  alerta_consumo_diario_default     NUMERIC,
  alerta_cobertura_unidad_default   TEXT CHECK (alerta_cobertura_unidad_default IN ('dias','semanas','meses')),
  alerta_cobertura_cantidad_default NUMERIC,

  creado_en        TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  actualizado_en   TEXT
);

CREATE TABLE IF NOT EXISTS usuarios (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre          TEXT NOT NULL,
  username        TEXT NOT NULL UNIQUE,
  email           TEXT UNIQUE,
  rol             TEXT NOT NULL CHECK (rol IN ('ADMIN','VENDEDOR')),
  password_hash   TEXT NOT NULL,
  activo          INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
  creado_en       TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  actualizado_en  TEXT
);

CREATE TABLE IF NOT EXISTS logs_actividad (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha       TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  usuario_id  INTEGER,
  accion      TEXT NOT NULL,
  entidad     TEXT NOT NULL,
  entidad_id  INTEGER,
  detalle     TEXT,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

/* ========= Catálogo ========= */
CREATE TABLE IF NOT EXISTS categorias (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre      TEXT NOT NULL UNIQUE,
  color_hex   TEXT,
  descripcion TEXT,
  padre_id    INTEGER,
  FOREIGN KEY (padre_id) REFERENCES categorias(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS unidades (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre    TEXT NOT NULL,
  simbolo   TEXT,
  decimales INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS productos (
  id                         INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre                     TEXT NOT NULL,
  sku                        TEXT UNIQUE,
  codigo_barras              TEXT UNIQUE,
  categoria_id               INTEGER,
  unidad_id                  INTEGER,
  costo_ultimo               NUMERIC NOT NULL DEFAULT 0,
  precio_venta               NUMERIC NOT NULL DEFAULT 0,
  stock_inicial              NUMERIC NOT NULL DEFAULT 0,
  stock_actual               NUMERIC NOT NULL DEFAULT 0,

  -- ====== Columnas de alertas ======
  stock_minimo               INTEGER,
  consumo_diario_estimado    NUMERIC,
  alerta_tiempo_unidad       TEXT CHECK (alerta_tiempo_unidad IN ('dias','semanas','meses')),
  alerta_tiempo_cantidad     INTEGER,
  nota                       TEXT,
  activo                     INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
  creado_en                  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  actualizado_en             TEXT,
  FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL,
  FOREIGN KEY (unidad_id)    REFERENCES unidades(id)   ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_productos_nombre    ON productos(nombre);
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);

/* ========= Precios ========= */
CREATE TABLE IF NOT EXISTS precios_historial (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id   INTEGER NOT NULL,
  precio_venta  NUMERIC NOT NULL,
  costo         NUMERIC NOT NULL,
  vigente_desde TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  usuario_id    INTEGER,
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id)  REFERENCES usuarios(id)  ON DELETE SET NULL
);

/* ========= Compras ========= */
CREATE TABLE IF NOT EXISTS compras (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha            TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  proveedor_nombre TEXT,
  numero_doc       TEXT,
  subtotal         NUMERIC NOT NULL DEFAULT 0,
  descuento_total  NUMERIC NOT NULL DEFAULT 0,
  total            NUMERIC NOT NULL DEFAULT 0,
  observacion      TEXT,
  usuario_id       INTEGER,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_compras_fecha ON compras(fecha);

CREATE TABLE IF NOT EXISTS compra_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  compra_id    INTEGER NOT NULL,
  producto_id  INTEGER NOT NULL,
  cantidad     NUMERIC NOT NULL,
  costo_unit   NUMERIC NOT NULL,
  subtotal     NUMERIC NOT NULL,
  FOREIGN KEY (compra_id)   REFERENCES compras(id)   ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_compra_items_compra   ON compra_items(compra_id);
CREATE INDEX IF NOT EXISTS idx_compra_items_producto ON compra_items(producto_id);

/* ========= Ventas ========= */
CREATE TABLE IF NOT EXISTS ventas (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha                  TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  correlativo_interno    TEXT NOT NULL UNIQUE,
  cliente_nombre         TEXT,
  subtotal               NUMERIC NOT NULL DEFAULT 0,
  descuento_total        NUMERIC NOT NULL DEFAULT 0,
  total                  NUMERIC NOT NULL DEFAULT 0,
  metodo_cobro           TEXT NOT NULL CHECK (metodo_cobro IN ('EFECTIVO','TARJETA','TRANSFERENCIA','MIXTO','OTRO')),
  observacion            TEXT,
  usuario_id             INTEGER,
  comprobante_activo_id  INTEGER,
  FOREIGN KEY (usuario_id)            REFERENCES usuarios(id)              ON DELETE SET NULL,
  FOREIGN KEY (comprobante_activo_id) REFERENCES comprobantes_internos(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ventas_fecha      ON ventas(fecha);
CREATE INDEX IF NOT EXISTS idx_ventas_usuario_id ON ventas(usuario_id);

CREATE TABLE IF NOT EXISTS venta_items (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id       INTEGER NOT NULL,
  producto_id    INTEGER NOT NULL,
  cantidad       NUMERIC NOT NULL,
  precio_unit    NUMERIC NOT NULL,
  descuento      NUMERIC NOT NULL DEFAULT 0,
  subtotal       NUMERIC NOT NULL,
  costo_unit_ref NUMERIC,
  FOREIGN KEY (venta_id)    REFERENCES ventas(id)    ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_venta_items_venta    ON venta_items(venta_id);
CREATE INDEX IF NOT EXISTS idx_venta_items_producto ON venta_items(producto_id);

/* ========= Ajustes de stock ========= */
CREATE TABLE IF NOT EXISTS ajustes_stock (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha        TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  producto_id  INTEGER NOT NULL,
  cantidad     NUMERIC NOT NULL,
  razon        TEXT NOT NULL CHECK (razon IN ('AJUSTE','CORRECCION','PERDIDA','DANIO','ROBO','INVENTARIO','VENCIMIENTO','OTRO')),
  nota         TEXT,
  usuario_id   INTEGER,
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT,
  FOREIGN KEY (usuario_id)  REFERENCES usuarios(id)  ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ajustes_stock_fecha     ON ajustes_stock(fecha);
CREATE INDEX IF NOT EXISTS idx_ajustes_stock_producto  ON ajustes_stock(producto_id);

/* ========= Libro mayor de inventario (logs) ========= */
CREATE TABLE IF NOT EXISTS logs_movimientos_inventario (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha            TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  producto_id      INTEGER,
  tipo             TEXT NOT NULL CHECK (tipo IN ('IN','OUT','ADJ')),
  cantidad         NUMERIC NOT NULL,
  costo_unit_est   NUMERIC,
  referencia_tipo  TEXT NOT NULL CHECK (referencia_tipo IN ('COMPRA','VENTA','AJUSTE','DEVOLUCION_VENTA','DEVOLUCION_COMPRA')),
  referencia_id    INTEGER NOT NULL,
  usuario_id       INTEGER,
  nota             TEXT,
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE SET NULL,
  FOREIGN KEY (usuario_id)  REFERENCES usuarios(id)  ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_movinv_fecha      ON logs_movimientos_inventario(fecha);
CREATE INDEX IF NOT EXISTS idx_movinv_prod_fecha ON logs_movimientos_inventario(producto_id, fecha);
CREATE INDEX IF NOT EXISTS idx_movinv_ref        ON logs_movimientos_inventario(referencia_tipo, referencia_id);

/* ========= Analítica ========= */
CREATE TABLE IF NOT EXISTS pronosticos (
  id                         INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id                INTEGER NOT NULL,
  periodo_yyyy_mm            TEXT NOT NULL,
  fecha_generado             TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  metodo                     TEXT NOT NULL CHECK (metodo IN ('RLIN','SMA','PROM_MOVIL','OTRO')),
  unidades_previstas         NUMERIC,
  stock_proyectado_fin_mes   NUMERIC,
  confianza                  NUMERIC,        -- %
  parametros_json            TEXT,
  usuario_id                 INTEGER,
  UNIQUE(producto_id, periodo_yyyy_mm),
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id)  REFERENCES usuarios(id)  ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS recomendaciones_compra (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  periodo_yyyy_mm   TEXT NOT NULL,
  fecha_generado    TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  producto_id       INTEGER NOT NULL,
  ventas_promedio   NUMERIC,
  stock_actual      NUMERIC,
  sugerido_comprar  NUMERIC,
  justificacion     TEXT,
  pdf_path          TEXT,
  usuario_id        INTEGER,
  UNIQUE(producto_id, periodo_yyyy_mm),
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id)  REFERENCES usuarios(id)  ON DELETE SET NULL
);

/* ========= Exportaciones / Importaciones (logs) ========= */
CREATE TABLE IF NOT EXISTS logs_exportaciones (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo          TEXT NOT NULL CHECK (tipo IN ('CSV','XLSX','PDF')),
  modulo        TEXT NOT NULL,
  rango_desde   TEXT,
  rango_hasta   TEXT,
  ruta_archivo  TEXT NOT NULL,
  creado_por    INTEGER,
  creado_en     TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS logs_importaciones (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  origen          TEXT NOT NULL,     -- 'PLANTILLA','CSV','XLSX', etc.
  modulo          TEXT NOT NULL,     -- 'productos','compras','ventas', etc.
  archivo_nombre  TEXT,
  estado          TEXT NOT NULL CHECK (estado IN ('OK','ERROR','PARCIAL')),
  filas_totales   INTEGER,
  filas_ok        INTEGER,
  filas_error     INTEGER,
  creado_por      INTEGER,
  creado_en       TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS logs_importacion_errores (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  importacion_id   INTEGER NOT NULL,
  fila_n           INTEGER,
  columna          TEXT,
  mensaje          TEXT,
  dato_crudo       TEXT,
  FOREIGN KEY (importacion_id) REFERENCES logs_importaciones(id) ON DELETE CASCADE
);

/* ========= Comprobantes internos (tabla hija de ventas, versionado) ========= */
CREATE TABLE IF NOT EXISTS comprobantes_internos (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id         INTEGER NOT NULL,
  version          INTEGER NOT NULL DEFAULT 1,
  tipo             TEXT NOT NULL DEFAULT 'INTERNO',
  leyenda          TEXT NOT NULL DEFAULT 'Documento interno sin validez tributaria. No entregar al cliente.',
  pdf_path         TEXT,
  pdf_hash         TEXT,
  pdf_filesize     INTEGER,
  pdf_paginas      INTEGER,
  template_nombre  TEXT,
  template_version TEXT,
  parametros_json  TEXT,
  generado_en      TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  generado_por     INTEGER,
  estado           TEXT NOT NULL DEFAULT 'ACTIVO',   -- ACTIVO | REEMPLAZADO | ANULADO
  es_actual        INTEGER NOT NULL DEFAULT 1 CHECK (es_actual IN (0,1)),
  UNIQUE(venta_id, version),
  FOREIGN KEY (venta_id)     REFERENCES ventas(id)    ON DELETE CASCADE,
  FOREIGN KEY (generado_por) REFERENCES usuarios(id)  ON DELETE SET NULL
);

/* ===================== Triggers de inventario ===================== */

-- COMPRA ITEMS: INSERT
CREATE TRIGGER IF NOT EXISTS trg_compra_items_ins
AFTER INSERT ON compra_items
FOR EACH ROW
BEGIN
  UPDATE productos
     SET stock_actual = stock_actual + NEW.cantidad,
         costo_ultimo = NEW.costo_unit
   WHERE id = NEW.producto_id;

  INSERT INTO logs_movimientos_inventario
    (fecha, producto_id, tipo, cantidad, costo_unit_est, referencia_tipo, referencia_id, usuario_id, nota)
  VALUES
    (CURRENT_TIMESTAMP, NEW.producto_id, 'IN', NEW.cantidad, NEW.costo_unit, 'COMPRA', NEW.compra_id,
     (SELECT usuario_id FROM compras WHERE id = NEW.compra_id), 'Ingreso por compra');
END;

-- COMPRA ITEMS: UPDATE (cantidad o costo)
CREATE TRIGGER IF NOT EXISTS trg_compra_items_upd
AFTER UPDATE OF cantidad, costo_unit ON compra_items
FOR EACH ROW
BEGIN
  UPDATE productos
     SET stock_actual = stock_actual + (NEW.cantidad - OLD.cantidad),
         costo_ultimo = NEW.costo_unit
   WHERE id = NEW.producto_id;

  INSERT INTO logs_movimientos_inventario
    (fecha, producto_id, tipo, cantidad, costo_unit_est, referencia_tipo, referencia_id, usuario_id, nota)
  VALUES
    (CURRENT_TIMESTAMP, NEW.producto_id, 'IN', (NEW.cantidad - OLD.cantidad), NEW.costo_unit, 'COMPRA', NEW.compra_id,
     (SELECT usuario_id FROM compras WHERE id = NEW.compra_id), 'Ajuste por edición de compra');
END;

-- COMPRA ITEMS: DELETE
CREATE TRIGGER IF NOT EXISTS trg_compra_items_del
AFTER DELETE ON compra_items
FOR EACH ROW
BEGIN
  UPDATE productos
     SET stock_actual = stock_actual - OLD.cantidad
   WHERE id = OLD.producto_id;

  INSERT INTO logs_movimientos_inventario
    (fecha, producto_id, tipo, cantidad, costo_unit_est, referencia_tipo, referencia_id, usuario_id, nota)
  VALUES
    (CURRENT_TIMESTAMP, OLD.producto_id, 'ADJ', -OLD.cantidad, OLD.costo_unit, 'COMPRA', OLD.compra_id,
     (SELECT usuario_id FROM compras WHERE id = OLD.compra_id), 'Reversa por eliminación de ítem de compra');
END;

-- VENTA ITEMS: INSERT
CREATE TRIGGER IF NOT EXISTS trg_venta_items_ins
AFTER INSERT ON venta_items
FOR EACH ROW
BEGIN
  UPDATE productos
     SET stock_actual = stock_actual - NEW.cantidad
   WHERE id = NEW.producto_id;

  INSERT INTO logs_movimientos_inventario
    (fecha, producto_id, tipo, cantidad, costo_unit_est, referencia_tipo, referencia_id, usuario_id, nota)
  VALUES
    (CURRENT_TIMESTAMP, NEW.producto_id, 'OUT', NEW.cantidad, NEW.costo_unit_ref, 'VENTA', NEW.venta_id,
     (SELECT usuario_id FROM ventas WHERE id = NEW.venta_id), 'Salida por venta');
END;

-- VENTA ITEMS: UPDATE (cantidad)
CREATE TRIGGER IF NOT EXISTS trg_venta_items_upd
AFTER UPDATE OF cantidad ON venta_items
FOR EACH ROW
BEGIN
  UPDATE productos
     SET stock_actual = stock_actual - (NEW.cantidad - OLD.cantidad)
   WHERE id = NEW.producto_id;

  INSERT INTO logs_movimientos_inventario
    (fecha, producto_id, tipo, cantidad, costo_unit_est, referencia_tipo, referencia_id, usuario_id, nota)
  VALUES
    (CURRENT_TIMESTAMP, NEW.producto_id, 'OUT', (NEW.cantidad - OLD.cantidad), NEW.costo_unit_ref, 'VENTA', NEW.venta_id,
     (SELECT usuario_id FROM ventas WHERE id = NEW.venta_id), 'Ajuste por edición de venta');
END;

-- VENTA ITEMS: DELETE
CREATE TRIGGER IF NOT EXISTS trg_venta_items_del
AFTER DELETE ON venta_items
FOR EACH ROW
BEGIN
  UPDATE productos
     SET stock_actual = stock_actual + OLD.cantidad
   WHERE id = OLD.producto_id;

  INSERT INTO logs_movimientos_inventario
    (fecha, producto_id, tipo, cantidad, costo_unit_est, referencia_tipo, referencia_id, usuario_id, nota)
  VALUES
    (CURRENT_TIMESTAMP, OLD.producto_id, 'ADJ', -OLD.cantidad, OLD.costo_unit_ref, 'VENTA', OLD.venta_id,
     (SELECT usuario_id FROM ventas WHERE id = OLD.venta_id), 'Reversa por eliminación de ítem de venta');
END;

-- AJUSTES STOCK: INSERT
CREATE TRIGGER IF NOT EXISTS trg_ajustes_stock_ins
AFTER INSERT ON ajustes_stock
FOR EACH ROW
BEGIN
  UPDATE productos
     SET stock_actual = stock_actual + NEW.cantidad
   WHERE id = NEW.producto_id;

  INSERT INTO logs_movimientos_inventario
    (fecha, producto_id, tipo, cantidad, costo_unit_est, referencia_tipo, referencia_id, usuario_id, nota)
  VALUES
    (CURRENT_TIMESTAMP, NEW.producto_id, 'ADJ', NEW.cantidad, NULL, 'AJUSTE', NEW.id, NEW.usuario_id,
     COALESCE(NEW.nota, 'Ajuste manual'));
END;

-- AJUSTES STOCK: UPDATE (cantidad)
CREATE TRIGGER IF NOT EXISTS trg_ajustes_stock_upd
AFTER UPDATE OF cantidad ON ajustes_stock
FOR EACH ROW
BEGIN
  UPDATE productos
     SET stock_actual = stock_actual + (NEW.cantidad - OLD.cantidad)
   WHERE id = NEW.producto_id;

  INSERT INTO logs_movimientos_inventario
    (fecha, producto_id, tipo, cantidad, costo_unit_est, referencia_tipo, referencia_id, usuario_id, nota)
  VALUES
    (CURRENT_TIMESTAMP, NEW.producto_id, 'ADJ', (NEW.cantidad - OLD.cantidad), NULL, 'AJUSTE', NEW.id, NEW.usuario_id,
     'Ajuste por edición');
END;

-- AJUSTES STOCK: DELETE
CREATE TRIGGER IF NOT EXISTS trg_ajustes_stock_del
AFTER DELETE ON ajustes_stock
FOR EACH ROW
BEGIN
  UPDATE productos
     SET stock_actual = stock_actual - OLD.cantidad
   WHERE id = OLD.producto_id;

  INSERT INTO logs_movimientos_inventario
    (fecha, producto_id, tipo, cantidad, costo_unit_est, referencia_tipo, referencia_id, usuario_id, nota)
  VALUES
    (CURRENT_TIMESTAMP, OLD.producto_id, 'ADJ', -OLD.cantidad, NULL, 'AJUSTE', OLD.id, OLD.usuario_id,
     'Reversa de ajuste');
END;

/* ===================== Triggers comprobantes internos (versionado) ===================== */

-- Asegura una sola version por venta al insertar
CREATE TRIGGER IF NOT EXISTS trg_comp_internos_actual_ins
BEFORE INSERT ON comprobantes_internos
FOR EACH ROW
WHEN NEW.es_actual = 1
BEGIN
  UPDATE comprobantes_internos
     SET es_actual = 0,
         estado   = CASE WHEN estado = 'ACTIVO' THEN 'REEMPLAZADO' ELSE estado END
   WHERE venta_id = NEW.venta_id
     AND es_actual = 1;
END;

-- Sincroniza ventas.comprobante_activo_id cuando entra una version actual
CREATE TRIGGER IF NOT EXISTS trg_comp_internos_set_activo_ins
AFTER INSERT ON comprobantes_internos
FOR EACH ROW
WHEN NEW.es_actual = 1
BEGIN
  UPDATE ventas
     SET comprobante_activo_id = NEW.id
   WHERE id = NEW.venta_id;
END;

-- Maneja cambio de es_actual a 1 en UPDATE
CREATE TRIGGER IF NOT EXISTS trg_comp_internos_actual_upd
BEFORE UPDATE OF es_actual ON comprobantes_internos
FOR EACH ROW
WHEN NEW.es_actual = 1 AND OLD.es_actual <> 1
BEGIN
  UPDATE comprobantes_internos
     SET es_actual = 0,
         estado   = CASE WHEN estado = 'ACTIVO' THEN 'REEMPLAZADO' ELSE estado END
   WHERE venta_id = NEW.venta_id
     AND es_actual = 1
     AND id <> OLD.id;
END;

-- Sincroniza ventas.comprobante_activo_id en UPDATE cuando pasa a ACTUAL
CREATE TRIGGER IF NOT EXISTS trg_comp_internos_set_activo_upd
AFTER UPDATE OF es_actual ON comprobantes_internos
FOR EACH ROW
WHEN NEW.es_actual = 1 AND OLD.es_actual <> 1
BEGIN
  UPDATE ventas
     SET comprobante_activo_id = NEW.id
   WHERE id = NEW.venta_id;
END;

COMMIT;
