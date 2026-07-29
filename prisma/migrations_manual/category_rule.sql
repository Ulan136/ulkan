-- Автоподстановка поставщика/логиста по группе каталога.
-- Выполнить ОДИН раз в консоли Neon (SQL Editor). db push НЕ использовать.
CREATE TABLE IF NOT EXISTS "CategoryRule" (
  "category"     TEXT PRIMARY KEY,
  "supplierName" TEXT NOT NULL DEFAULT '',
  "supplierId"   TEXT NOT NULL DEFAULT '',
  "logistName"   TEXT NOT NULL DEFAULT '',
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
