-- Связь закуп→продажа (цепочка для отчёта). Выполнить ОДИН раз в Neon SQL Editor.
-- db push НЕ использовать. Таблица новая — приложение до миграции не ломается
-- (все чтения обёрнуты в try/catch).
CREATE TABLE IF NOT EXISTS "ProcurementLink" (
  "id"             TEXT PRIMARY KEY,
  "purchaseCardId" TEXT NOT NULL,
  "saleCardId"     TEXT NOT NULL,
  "product"        TEXT NOT NULL DEFAULT '',
  "qty"            DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ProcurementLink_purchaseCardId_idx" ON "ProcurementLink"("purchaseCardId");
CREATE INDEX IF NOT EXISTS "ProcurementLink_saleCardId_idx" ON "ProcurementLink"("saleCardId");
