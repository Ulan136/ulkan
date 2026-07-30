# BLUEPRINT — полный чертёж системы UKan (для пересборки с нуля)

Этот файл — «чёрный ящик»: полная логика и строение программы. По нему можно
воссоздать UKan заново. Держать в актуальном состоянии при изменениях логики.
Дополняет `METHOD-ulkan.md` (метод/грабли) и `TZ.md` (исходное ТЗ, местами устарел).

Последнее крупное обновление: закуп/продажа, нумерация ЗП/ПР, стадия-накопитель (июль 2026).

---

## 0. Что это и стек

**UKan** — CRM/логистика для торговли металлом (водосток, евробрус, комплектующие,
металлочерепица). Приёмка заявок → закуп товара на склад → продажа/доставка заказчикам.

- **Next.js 15 (App Router)** + React, TypeScript (`strict:false`).
- **Prisma 5.22** → **Postgres (Neon)**. ⛔ В той же базе живёт второй проект (касса) →
  `prisma db push`/`migrate` ЗАПРЕЩЕНЫ, только ручной SQL в Neon.
- **Realtime**: Pusher (WS) + поллинг-страховка (`lib/live.ts`), работает и без Pusher-ключей.
- **Auth**: jose JWT в httpOnly-cookie `ukan_session`.
- **Хостинг**: Vercel. **Билд**: `prisma generate && next build`.
- Деньги — авторитет 1С (планируется своя 1SAT). UKan — оперативный слой.

---

## 1. Роли и авторизация

Роли (`User.role`): `super_admin`, `bookkeeper`, `logist`, `branch`, `client`, `supplier_client`, (`warehouse_manager` — частично).

- **super_admin/bookkeeper** — админ-оболочка `/admin` (`components/AdminApp.tsx`).
- **logist** — портал `/rsp/[slug]` (`LogistPortal.tsx`).
- **branch** — портал `/branch/[slug]` (`BranchPortal.tsx`).
- **client / supplier_client** — кабинет `/client/[slug]` (`ClientApp.tsx`).
- **warehouse_manager** — `/warehouse/[slug]` (`WarehousePortal.tsx`).

**Auth (`lib/auth.ts`)**: `createToken(user, days=365)` (jose HS256, `AUTH_SECRET`),
`verifyToken`, `getSession()` (Server Components), `getSessionFromRequest(req)` (API/Edge),
`requireSession(req, roles?)` → `{ok, session|response}`. Fallback: если у старого JWT
нет `role`, подтягивается из БД по id. Cookie: httpOnly + SameSite=Lax + Secure(prod) + maxAge 1 год.

**Входы**: `/api/auth/login` (email+bcrypt), `/api/auth/phone` (ТОЛЬКО телефон, без пароля — дыра, чинить в v2),
`/api/auth/register` (роль всегда `client`). **Middleware** (`middleware.ts`, Edge): PUBLIC-список +
slug-порталы пропускаются, остальное → `/login` если нет сессии. Роль на `/admin` дополнительно
гейтится в самой странице.

**Изоляция данных**: запросы скоупятся по `session.id` (напр. `/api/client/orders` фильтрует
`fromId: session.id`), НЕ по параметру от клиента.

---

## 2. Модель данных (Prisma)

Модели: `User, Order, Position, History, Project, SpecProject, SpecProjectItem, Supplier,
Nomenclature, Stock, StockMovement, DailyReport, DailyReportRow, Notification, PaymentStatus,
CardMessage, CategoryRule, ProcurementLink`.

### Order (карточка) — ключевые поля
`id` (строковый PK, формат см. §7), `from`, `fromId?` (клиент-создатель), `to` (получатель),
`screen` (incoming|reception|outgoing|accounting|bookkeeping|archive), `block` (''|waiting|processing),
`status`, `source` (cabinet|admin_manual|external|webhook|responsible_portal), `projectId?`,
`specProjectId?`, `contactId?`, `comment`, `phone?`, `deadline?`, `delivered?`, `isDraft`,
`isChanged`+`changeText`+`changePhone`, `isCancelled`+`cancelReason`, `toacc` (готов к учёту),
`postponed`, `invoice`, `fact`, `posted1C`, `cold`, `trackingLink`, `sortOrder`, `leg`
(1=первое плечо у филиала-поставщика, 2=обычная), `createdAt`, `updatedAt`. Relations: contact,
project, specProject, positions[], history[].

### Position — ключевые поля
`id` (`{cardId}-P{n}`), `cardId`, `name1c`, `oral` (имя со слов/с RAL), `qty`, `unit`, `price`,
`resp` (логист-ответственный, строка-имя), `supplierId?` (FK→Supplier), `supplier` (строка-имя!),
`status` (В работе|Готово|В пути|Доставлено), `leg`, `late`, `payment`, `deadline?`.
⚠️ `supplier` — это ИМЯ (часто пользователь-supplier_client), `supplierId` — только если совпало
с записью `Supplier` (иначе null). НЕ писать в supplierId id пользователя (FK-краш).

### Nomenclature (каталог 1С)
`name`, `unit`, `group`, `cat`, `subgroup`, `priceIn` (приход/закуп), `priceRetail`, `priceOpt`.
⚠️ Поля цен добавлены ручным SQL; читать защищённо (explicit select / try-catch), т.к. до ALTER
их не было — «ral-инцидент». Данные 1С местами имеют перепутанные group↔cat (напр. «Евро брус»:
group='Евро брус', cat='Товары') → сравнение полей терпимое к ориентации.

### Supplier / Stock / StockMovement
`Supplier{name unique, type, active}`. Центр-Склад — имя `'Центр Склад'` (см. §6).
`Stock{supplierId, nomenclatureId, name, qty...}`, `StockMovement` — движения (приход/резерв/списание).

### CategoryRule (НОВАЯ, ручной SQL) — автоподстановка по группе
`category` (PK: `vodostok|materialy|eurobrus|komplekt`), `supplierName`, `supplierId`, `logistName`,
`updatedAt`. 4 строки. См. §5. SQL: `prisma/migrations_manual/category_rule.sql`.

### ProcurementLink (НОВАЯ, ручной SQL) — связь закуп→продажи
`id`, `purchaseCardId` (карточка закупа), `saleCardId` (исходная заявка-продажа), `product`
(name1c), `qty`, `createdAt`. Индексы по обоим cardId. Это реестр связанных приход/расход
документов (основа для 1С-накладных и Финанса). SQL: `prisma/migrations_manual/procurement_link.sql`.

### Прочее
`History{cardId, action, detail?, userName, createdAt}` — аудит. `CardMessage{cardId, userId,
userName, role, text, createdAt}` — чат карточки (FK-каскада нет, чистить вручную при удалении).
`DailyReport`+`DailyReportRow` — смена логиста. `Notification`, `PaymentStatus`.

---

## 3. Экраны

### Админ-оболочка (`AdminApp.tsx`, ~2600 строк)
Левый сайдбар NAV → `switch(screen)`. Экраны (`AdminScreen`): dashboard, history, incoming,
reception, outgoing, **procurement** (Закуп-отчёт), filter, accounting, warehouse, bookkeeping,
archive, nomenclature, settings. `counts: Record<AdminScreen,number>` — бейджи NAV.

- **Входящие**: вкладки Новые/Изменения/К учёту/Черновики/Отменённые. Карточки с бейджем
  Закуп/Продажа (цвет), инлайн-шторка позиций, кнопки по вкладке (Принять/Отменить/Отложить).
- **Приёмка**: Блок 1 форма создания (2 кнопки «Создать заказ»/«Создать закуп»); блок
  **«Автозакуп»** (сводка потребности); блок **«Черновик закупа»** (стадия-накопитель);
  Блок 2 «Стол приёмки» (block=processing, редактирование позиций); Блок 3 «Ожидание».
- **Закуп-отчёт** (`ProcurementReport.tsx`): таблица ЗАКУП|СКЛАД|ПРОДАЖА (цепочка).
- **Настройки**: вкладки Пользователи/Проекты/СпецПроекты/Номенклатура/Оплата/**Автоподстановка**.
- **CardDetailModal** (top-level функция): открывается по `selectedOrder`; вкладки позиции/история/чат;
  кнопки действий по состоянию; редактирование поставщика позиции; danger-zone (отмена/восстановление/удаление).

### Порталы
- **Логист** (`LogistPortal.tsx`): плавающие круглые вкладки справа — 💰 Продажа / 🛒 Закупки /
  ✅ Выполнено / ⚡ Изменения / ➕ Новый / 📊 Смена. Работа по позициям (StatusBtns:
  В работе→В пути→Доставлено). Смена = дневной отчёт (черновики `/api/reports/draft`).
- **Филиал** (`BranchPortal.tsx`): плавающие вкладки Входящие/Исходящие/Финансы/Новый.
  Создание заявки через каталог-пикер.
- **Клиент/заказчик** (`ClientApp.tsx`): широкий десктоп-лейаут, верхние вкладки Мои заявки/
  Новая заявка/Финансы/Уведомления (+Входящие у филиала). Создание через каталог NomPicker.
- **Трекинг** (`/track`, `TrackingApp.tsx`): публичный статус по id.

---

## 4. Жизненный цикл карточки и переходы (`services/orderWorkflow.ts`)

Декларативная карта `TRANSITIONS[action]: {roles?, guard, effects, patch, history}`. Тонкий
диспетчер `app/api/orders/[id]/action/route.ts`: `requireSession` → def → roles → guard →
effects → patch (order.update) → history → `pushSignal('orders')`.

**Основной поток продажи**: заявка (incoming) → `accept` → приёмка (reception, block=waiting) →
`take` → block=processing (парсинг comment в позиции + **автоподстановка поставщика/логиста +
срок=сегодня**) → назначить логиста → `process` (guard: получатель + логист у всех позиций) →
outgoing → логист возит (updatePos по позициям) → все Доставлено → приход на Центр-Склад +
статус delivered, toacc=true → `sendAcc` → accounting → `postAcc` → bookkeeping → archive.

Действия (полный список): accept, take, process, updatePos, markAll, sendAcc, postAcc, returnOut,
returnToReception, returnToAcc, returnToIncoming, reopenOutgoing, cancel, restore, updateOrder,
branchForward, branchAccept, branchRecall, confirmChg, postpone, createDoc, sendArchive, unarchive,
changeOrder, addPos, updatePosDetail, deletePos, updateCard, **finalizePurchase**.

Ключевые: `updatePosDetail` — частичный патч позиции (supplier/resp/price/qty/deadline — не
затираются непереданные поля, слияние на сервере). `addPos` — добавить позицию (+автоцена, чат).
`returnToIncoming` — без guard, возврат во Входящие.

---

## 5. Автоподстановка по группе (CategoryRule)

Настройки → «Автоподстановка»: для каждой из 4 категорий каталога (Водосток/Материалы/Евробрус/
Комплектующие) задаётся постоянный **поставщик** и **логист**. При `take` (взятие в обработку)
и при стейджинге закупа каждая позиция получает поставщика+логиста по своей группе (только пустые
поля), срок=сегодня. Определение группы: `matchCategoryKey(group, cat)` в `lib/nomCatalog.ts`
(терпимо к перепутанным group↔cat). Хелпер `applyReceptionDefaults` в orderWorkflow.
API: `/api/settings/category-rules` (GET/PUT), `/api/procurement/autofill` (preview по именам).

---

## 6. Склад / Центр-Склад (`services/stockOps.ts`, `lib/procurement.ts`)

`CENTER_SKLAD = 'Центр Склад'` — единый источник в `lib/procurement.ts` (клиент-безопасно, без prisma).
- Позиция с `supplier === CENTER_SKLAD` → **резервируется** со склада при создании
  (`reserveCenterSkladPositions`), **списывается** при доставке (`releaseDeliveredPosition`).
- Карточка с `to === CENTER_SKLAD` (закуп) → при полной доставке **приход** на Центр-Склад
  (`incomeOnDeliveryToCenter`). Так закуп пополняет склад, продажа списывает — баланс сходится.

---

## 7. Закуп / Продажа (ключевая система)

**Тип карточки БЕЗ колонки в БД**: закуп ⇔ `to === 'Центр Склад'`. Хелперы `isPurchase(o)`,
`kindLabel(o)` в `lib/procurement.ts`. (Так сделано чтобы не добавлять скаляр в Order — Prisma
селектит все скаляры везде, новая колонка до ALTER уронила бы все чтения заказов.)

**Нумерация id** (`lib/ids.ts` `generateCardId(count, kind)`): закуп → `ЗП-0001-DDMMYY`,
продажа → `ПР-0001-DDMMYY`. Счётчики **раздельные** (count по своему типу: `to===Центр-Склад`
vs `NOT`). До 9999, дальше круг с меткой ` [1]`,` [2]`. Старые `C-…` не трогаем. `trackingLink`
кодирует id (encodeURIComponent). Тип для нумерации берётся из `to` в POST `/api/orders`.

**Поток закупа = стадия-накопитель**:
1. Приёмка → блок **«Автозакуп»** = сводка потребности: агрегирует позиции всех новых входящих
   продаж по товару (name1c), с разбивкой по заявкам-заказчикам. Товары, уже попавшие в закуп
   (есть в ProcurementLink), из сводки исключаются (`procuredPairs`, эндпоинт `/api/procurement/links`).
2. Отметил товары → **«В закуп»** → `POST /api/procurement/stage`: find-or-create **черновик-
   накопитель** (isDraft закуп на Центр-Склад), добавляет позиции + пишет ProcurementLink +
   автоподстановка поставщика/логиста по группе. Повторное «В закуп» дополняет тот же черновик.
   Оптимистичное скрытие из сводки сразу (не ждём Pusher).
3. Блок **«Черновик закупа»** в приёмке: назначить закупщика (=логиста) и поставщика (по одной/
   ко всем), правка кол-ва. Поставщик выбирается из ПОЛЬЗОВАТЕЛЕЙ (supplier_client/client/branch)
   + внешних Supplier-сущностей (`UnifiedSelect roles + includeSuppliers`).
4. **«Оформить закуп»** → transition `finalizePurchase` (guard: у всех позиций логист+поставщик) →
   isDraft=false, screen=outgoing → уходит логисту (вкладка «Закупки»).
5. Логист закупает (по позициям → Доставлено). Полная доставка → **приход на Центр-Склад** +
   **автооткрытие продаж** (`openLinkedSales`): связанные заявки-продажи получают на позициях
   **начального поставщика из закупа** (НЕ Центр-Склад — склад лишь транзит) + сигнал в чат/админам.

**Поставщик — только в закупе.** В форме создания продажи и на Столе приёмки колонки «Поставщик»
НЕТ (только логист). Продажа наследует реального поставщика из закупа автоматически.

**Закуп-отчёт (цепочка / «блокчейн»)** `/api/procurement/report` + `ProcurementReport.tsx`:
таблица с группами колонок **ЗАКУП** (поставщик · товар · куплено) | **СКЛАД** (Центр-Склад ·
остаток/перебор) | **ПРОДАЖА** (заказчик · кол-во · коммент). Заказчик = клиент заявки
(`fromId`→имя, иначе `from`; поле `to` НЕ используется — туда мог попасть поставщик). Строится
из ProcurementLink. Это черновик приход/расход накладных: приход = кол-во×`priceIn`,
расход = кол-во×цена клиента (`priceRetail`/`priceOpt`).

**Смысл для будущего**: закуп-карточка = приходная накладная (долг поставщику), продажа =
расходная (выручка/долг клиента), ProcurementLink = связка документов. Основа двойной проводки,
интеграции с 1С/1SAT и Финанса.

---

## 8. Ценообразование (`services/pricing.ts`)

`Nomenclature.priceIn/priceRetail/priceOpt` + `User.priceType` ('retail'|'opt'). `clientPriceType(to,
fromId)` → тип цены получателя; `resolvePrice(name1c, priceType)` (нечувствительно к регистру +
fallback по contains, try/catch→null); `applyAutoPrices(positions, to, fromId)` — авто-подтягивание
цен при создании и в реальном времени в форме приёмки («💰 Подтянуть цены»). Все чтения новых
колонок цен — защищённо (устойчиво к отсутствию колонок до ALTER).

---

## 9. Real-time (`lib/live.ts`, `lib/pusherServer.ts`)

Сервер: `await pushSignal(channel)` ПОСЛЕ всех записей БД, перед `return` (иначе на Vercel
функция «замерзает»). Каналы: `orders`, `reports`, `settings`. Клиент: `useLiveData(channel,
load, deps, pausedRef?)` — загрузка на mount + по сигналу + страховочный поллинг (20с когда WS
не connected, 5 мин когда жив) + visibilitychange/online. Работает и без Pusher-ключей (поллинг 10с).
`pausedRef` — пауза live-обновления пока открыт редактор/форма (иначе сброс ввода).

---

## 10. Каталог номенклатуры

`lib/nomCatalog.ts` — `NOM_CATALOG_TREE` (group→cat→subgroup) + `CATALOG_CATEGORIES` (4 плоские:
Водосток/Материалы/Евробрус/Комплектующие с полями group/cat) + `matchCategoryKey`. `NomPicker`
(каталог-меню, RAL-круги, клавиатура кол-ва) и `NomSearch` — помощники ПОИСКА по реальной базе
(цвет/категория/подкатегория собирают запрос, не строят имя). RAL: `lib/ral.tsx` (14 цветов +
`extractRal`, `RalDot`). Поиск устойчив к запятая/точка и перепутанным group/cat.

---

## 11. Ручные SQL-миграции (выполнять в Neon SQL Editor)

Лежат в `prisma/migrations_manual/`:
- `category_rule.sql` — таблица CategoryRule (автоподстановка).
- `procurement_link.sql` — таблица ProcurementLink (связь закуп↔продажи, отчёт).
- Ранее ручным SQL: колонки `Nomenclature.priceIn/priceRetail/priceOpt`, `User.priceType`.

Правило: правим `schema.prisma` (для типов) → `npx prisma generate` → владелец выполняет
эквивалентный `ALTER/CREATE` в Neon. Новые таблицы читать в коде через try/catch (до миграции — []).

---

## 12. Инварианты и правила (нарушать нельзя)

1. ⛔ Никаких `prisma db push`/`migrate` — общая база с кассой. Только ручной SQL.
2. Новые скаляры в широко-читаемых моделях (Order/Position) — опасны (Prisma селектит всё до ALTER).
   Признаки-флаги выводить из существующих полей где можно (пример: закуп из `to`).
3. `.env.txt` не коммитить (содержит DATABASE_URL — уже утёк в историю, сменить пароль Neon в v2).
4. `pushSignal` после всех записей, перед return.
5. Даты: день Алматы `almatyDay()`, дефолты `todayLocal()`, не `toISOString().slice(0,10)`.
6. `Position.supplierId` — строго FK на Supplier (или null). Имя поставщика (юзер) — только в `supplier`.
7. Карточные/stateful компоненты — на верхнем уровне модуля (иначе ремонтирование поддерева).
8. Каждый async-блок = 3 исхода на экране: данные / пусто / ошибка.
9. Один промпт = один коммит; цикл `tsc → build → commit → push → проверка прода`.

---

## 13. Известные хвосты (v2)

Безопасность (чинить в v2 с нуля): беспарольный вход по телефону; фолбэк `AUTH_SECRET`; утёкший
`.env.txt`/пароль Neon; нет рейт-лимита на auth. Финанс: сейчас заглушка (`/api/finance`),
план — свой реестр на базе закуп/продажа + ProcurementLink. Касса → отдельная БД. Отчёт логиста:
раздельный учёт закуп/продажа — не сделан (обсуждается). Детали — `docs/periphery-audit.md`,
`docs/METHOD-ulkan.md` §5.
