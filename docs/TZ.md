# ТЗ «как есть» — система ulkan

Логистическая CRM: заявки клиентов → приёмка → изготовление/закуп → доставка → учёт → бухгалтерия → архив. Двухплечевая доставка (филиал изготавливает → логист везёт клиенту), склад, отчёты смен логистов, публичный трекинг.

Стек: **Next.js 14 (App Router)** · **Prisma 5 / PostgreSQL (Neon)** · **JWT (jose)** · **Pusher** (real-time). Хостинг — **Vercel** (`ulkan.vercel.app`).

> Документ описывает поведение **по фактическому коду** (не по старым ТЗ). Расхождения кода со здравым смыслом помечены **⚠ особенность**.

---

## 1. Роли и интерфейсы

Роль хранится в `User.role` (строка). Значения в коде:

| Роль | Интерфейс (компонент) | URL | Что видит / делает |
|---|---|---|---|
| `super_admin` | `AdminApp` | `/admin` | Все экраны конвейера, настройки, пользователи, номенклатура, склад, бухгалтерия |
| `bookkeeper` | `AdminApp` | `/admin` | То же, что super_admin (NAV не фильтруется по роли — **⚠ особенность**), но мутации пользователей/номенклатуры/проектов ограничены на сервере |
| `logist` | `LogistPortal` | `/rsp/<slug>` | Позиции, назначенные ему (`resp==имя`, плечо 2), статусы доставки, отчёт смены |
| `branch` | `BranchPortal` | `/branch/<slug>` | Позиции, где он поставщик; принять/передать логисту/вернуть; свои заявки |
| `client`, `supplier_client` | `ClientApp` | `/client/<slug>` | Свои заявки, трекинг, подача новой заявки, уведомления |
| `warehouse` | `WarehousePortal` | `/warehouse/<slug>` | Склад центрального склада (приход/остатки) |

Прочие страницы: `/` — лендинг (`HomeClient`, входы в кабинеты), `/login`, `/register`, `/track` — публичный трекинг.

**Права закреплены серверными гардами** (см. §7), а не только UI. AdminApp — админская оболочка; порталы (branch/logist/client) её не рендерят.

⚠ **`warehouse_manager`** присутствует в списке ролей формы создания пользователя, но отсутствует в цветах/лейблах ролей и в форме редактирования (осиротевшая роль).

---

## 2. Модель данных (`prisma/schema.prisma`)

| Модель | Назначение / ключевые поля |
|---|---|
| **User** | Пользователь. `id`(cuid), `name`, `phone?`(uniq), `email?`(uniq), `password?`(bcrypt), `role`(default `client`), `companyId?`(суб-пользователь → head-компания, self-relation `SubUsers`), `slug?`(uniq, для URL кабинета), `active`. **⚠** `companyId` принимается роутами, но UI-формы для него нет (суб-пользователи не назначаются через интерфейс). |
| **Order** | Карточка заказа. `id`(`C-NNN-ddmmyy`), `from`/`fromId`(заказчик), `to`(получатель/логист-направление), `screen`(экран конвейера), `block`(под-стадия приёмки), `status`(текст), `source`, `projectId?`/`specProjectId?`/`contactId?`, `comment`, `phone?`, `deadline?`, `delivered?`, флаги `isDraft`/`isChanged`/`isCancelled`/`toacc`/`postponed`/`invoice`/`fact`/`posted1C`/`cold`, `cancelReason`, `changeText`/`changePhone`, `trackingLink`, `sortOrder`. |
| | **⚠ `Order.leg`** (Int, default 2) — **мёртвое поле**. Плечо теперь на позиции (`Position.leg`). Код филиала/логиста на `Order.leg` не смотрит. |
| **Position** | Позиция карточки. `id`(`<cardId>-P<n>`), `cardId`, `name1c`(наим. 1С), `oral`(устное), `qty`, `unit`, `price`, `resp`(логист-исполнитель), `supplierId?`/`supplier`(имя поставщика), `status`, **`leg`**(1=у филиала-изготовителя, 2=обычная/у логиста), `late`, `payment`, `deadline?`. Каскадное удаление с картой. |
| **History** | Лента событий карточки. `cardId`, `action`, `detail`, `userName`, `createdAt`. |
| **Project / SpecProject** | Проект / спецпроект (смета). `status`(`active`/`archive`), `clientId?`. SpecProject имеет `items` (`SpecProjectItem`: `name`, `qty`, `unit`, `nomenclatureId?`). |
| **Supplier** | Поставщик. `name`(uniq), `type`, `active`. |
| **Nomenclature** | Справочник номенклатуры. `name`, `unit`, `group`, `cat`, `subgroup`. |
| **Stock** | Складской остаток. `supplierId`+`nomenclatureId`+`name`, `qty`, `reserved`. |
| **StockMovement** | Движение склада. `type`(`reserve`/`expense`/`income`), `name`, `qty`, `positionId?`, `cardId?`. |
| **DailyReport** | Смена логиста за день. `logistId`, `date`(ключ дня Алматы 00:00), `status`(`draft`→`processing`→`done`/`archive`), `rows`. |
| **DailyReportRow** | Строка смены: `fromWho`(поставщик), `name`, `qtyIn`, `toWho`(клиент), `qtyOut`, `commentIn/Out`, `invoiceNum`. |
| **Notification** | Уведомление пользователя. `userId`, `text`, `cardId?`, `read`. |
| **PaymentStatus** | Справочник статусов оплаты. `name`(uniq), `active`. |

---

## 3. Жизненный цикл карточки

### Конвейер экранов (`Order.screen`)

```
incoming ─accept→ reception(block=waiting) ─take→ reception(block=processing) ─process→ outgoing
   ▲                                                                                      │
   │                                   (все позиции Доставлено: updatePos/markAll)         │
   └──────────────────────────────── incoming(доставлено, toacc) ◀───────────────────────┘
                                            │ sendAcc
                                            ▼
                             accounting ─postAcc→ bookkeeping ─sendArchive→ archive
```

Константы экранов/статусов — `lib/orderStatus.ts` (`SCREENS`, `CARD_STATUS`, `POS_STATUS`).

### Диспетчер `POST /api/orders/:id/action`

Тонкий роут: `requireSession` → загрузка заказа (`orderInclude`) → `def = TRANSITIONS[action]` (нет → 400) → `roles` (→403) → `guard` (→400 или свой статус) → `effects()` → `patch()` → `history()` → общий хвост: `order.update(patch)`, `history.create`, re-fetch, **`await pushSignal('orders')`**, ответ. Вся логика — в `services/orderWorkflow.ts` (`TRANSITIONS`).

`TransitionDef = { roles?, guard?(ctx)→текст|{error,status}|null, patch?(ctx)→Partial<Order>|null, effects?(ctx)→Promise, history?(ctx)→string|null }`; `ctx = { order, positions, session, payload, prisma, scratch }` (`scratch` — обмен данными между effects/patch/history).

### Полная карта TRANSITIONS

| action | откуда (guard) | patch карточки | эффекты | History |
|---|---|---|---|---|
| `accept` | screen=incoming | reception, block=waiting, status=Принят | — | «Принят в приёмку» |
| `take` | reception+waiting | status=В обработке, block=processing | если 0 позиций и есть comment — парсит построчно в позиции (qty+ед. по regex) | «Взят в обработку» |
| `process` | reception; **+ комплектность**: `to` не пуст, у каждой позиции `resp` не пуст | outgoing, status=В работе, block='' | резерв позиций «Центр Склад» (`reserveCenterSkladPositions`, только с name1c) | «Отправлен в Исходящие (+зарезервировано N)» |
| `updatePos` | — | при allDone → incoming/Доставлено/toacc/delivered; при откате назад → см. §ниже | ставит статус позиции; списание Центр-Склад при→Доставлено; уведомление клиента (только вперёд); авто-правило «все доставлены»; **откат назад** (см. §3.1) | статусные строки / «Все позиции доставлены» / «Доставка отменена…» |
| `markAll` | — | incoming/Доставлено/toacc/delivered | все позиции→Доставлено; списание Центр-Склад впервые доставленных; notifyAdmins; авто-приход | «Все позиции доставлены (+приход N)» |
| `sendAcc` | incoming + toacc | accounting, status=К учёту | — | «Отправлен к учёту» |
| `postAcc` | accounting | bookkeeping, status=Бухгалтерия, toacc=false | — | «Проведён в бухгалтерию» |
| `sendArchive` | bookkeeping + `posted1C` | archive, status=Архив | — | «Отправлен в архив» |
| `createDoc` | тип ∈ {invoice,fact} иначе 400 | invoice=true / fact=true | — | «Счёт сформирован» / «Счёт-фактура сформирована» |
| `post1C` | — | posted1C=true | — | «Проведён в 1С» |
| `postpone` | — | postponed=!postponed | — | «Отложен» / «Снят с отложенных» |
| `cancel` | — | isCancelled, status=Отменён, screen=incoming, cancelReason | — | «Отменён (+причина)» |
| `restore` | — | isCancelled=false, status=В ожидании, incoming | — | «Восстановлен из отменённых» |
| `updateOrder` | — | условно `to`/`deadline` | — | «Карточка обновлена: <поля>» (или ничего) |
| `updateCard` | — | from,to,comment,phone,deadline,project/spec/contact | — | «Карточка обновлена» |
| `confirmChg` | — | isChanged=false | notify клиенту | «Изменение подтверждено» |
| `changeOrder` | — | isChanged, changeText, changePhone | notifyAdmins | «Клиент внёс изменение» |
| `addPos` | branch/logist — только свою позицию (роль-гард 403) | — | создаёт позицию (`leg` по поставщику), резерв Центр-Склад, notify логиста при leg=2 | «Добавлена позиция: …» |
| `updatePosDetail` | branch/logist — только свою (403) | — | обновляет позицию (частичный merge), `updateReserve` если Центр-Склад | «Позиция <id> изменена» |
| `deletePos` | — | — | снимает резерв Центр-Склад (если не доставлена), удаляет позицию | «Позиция удалена» |
| `branchAccept` / `branchForward` / `branchRecall` | см. §4 | — | см. §4 | см. §4 |

#### 3.1. Откат статуса позиции назад (`updatePos`)

Порядок статусов: `В работе(0) → Готово к отгрузке(1) → В пути(2) → Доставлено(3)`. Движение назад (`newRank < oldRank`):
- **(a)** если позиция была `Доставлено` → удаляет её авто-строку из **сегодняшнего draft-отчёта** логиста (по `name`+`toWho`); если смена уже закрыта (не draft) — строку не трогает, в History «(смена уже закрыта)».
- **(b)** если карта была авто-доставлена (`status=Доставлено`) и теперь не все доставлены → возвращает карту в outgoing/В работе/toacc=false/delivered=null. History «Доставка отменена: позиция X → …».
- **(c)** склад **НЕ откатывается** (списание/приход физически случились).
- **(d)** клиенту об откате **не уведомляем**.

### Возвраты (7 путей) — что откатывают

| Возврат (action) | Откуда → куда | Позиции | Склад | Флаги/прочее |
|---|---|---|---|---|
| `returnOut` | outgoing → incoming/В ожидании | → «В работе» (кроме leg=1) | **не откат** | toacc=false, delivered=null |
| `returnToReception` | outgoing → reception/processing | → «В работе» (кроме leg=1) | не откат | — |
| `returnToAcc` | bookkeeping → accounting/К учёту | **не трогать** (доставлены — правда) | не трогать | invoice/fact/**posted1C НЕ сбрасываются** |
| `unarchive` | archive → bookkeeping/Бухгалтерия | не трогать | не трогать | **posted1C остаётся** (проведение — факт), cold=false |
| `returnToIncoming` | (стол приёмки / К учёту) → incoming/В ожидании | не трогать | не трогать | toacc=false |
| `reopenOutgoing` | incoming(доставлено) → outgoing/В работе | → «В работе» (кроме leg=1) | не откат | toacc=false, delivered=null |
| `updatePos` откат назад | см. §3.1 (доставка отменена) | одна позиция → назад | **не откат** | + удаление строки смены |

`returnToIncoming`/`reopenOutgoing` — без guard состояния (кнопки «шаг назад» вне канонических возвратов).

---

## 4. Двухплечевая модель (per-position)

Товар от филиала-изготовителя проходит **два плеча**: 1) филиал делает, 2) логист везёт клиенту.

- **`Position.leg`**: `1` = у филиала-изготовителя (логисту **не видна**), `2` = обычная / передана логисту.
- Плечо задаётся **поставщиком**: `legForSupplier(supplier)` → если `supplier` — пользователь роли `branch`, то `leg=1`, иначе `leg=2` (`services/legDetection.ts`).

### Предикаты состояния (`lib/positionState.ts`, клиент-безопасны)

```
isHandedOff(p)  = status ∈ {Готово к отгрузке, В пути, Доставлено}   // передана логисту
isInDelivery(p) = status ∈ {В пути, Доставлено}                       // доставка идёт/готова
myActivePos(pos, me) = supplier==me & НЕ handed                       // ещё у филиала
myHandedPos(pos, me) = supplier==me & handed                          // передана логисту
```

⚠ **Важно**: UI филиала и серверные фильтры `branchAccept/Forward/Recall` работают **по СТАТУСУ, а не по `leg`** — потому что у старых данных `leg` бывал битым (правился SQL-ом). `leg` продолжает **проставляться** сервером (Forward→2, Recall→1), т.к. он нужен фильтру логиста, но код филиала от него не зависит.

### Действия филиала

| Действие (action) | Серверный фильтр позиций | Результат | Уведомление |
|---|---|---|---|
| `branchAccept` | supplier==me & status=«В работе» | → «Принято филиалом» | — |
| `branchForward` | supplier==me & status=«Принято филиалом» | → `leg=2`, «Готово к отгрузке» | логистам позиций |
| `branchRecall` (роль branch, 403) | supplier==me & handed & не в доставке | → `leg=1`, «Принято филиалом» | логистам позиций |

### Видимость и кнопки филиала

| Статус позиции (supplier==филиал) | Вкладка филиала | Кнопка | leg | Видит логист? |
|---|---|---|---|---|
| В работе | Входящие (active) | ✓ Принял | 1 | нет |
| Принято филиалом | Входящие (active) | К логисту → | 1 | нет |
| Готово к отгрузке | Исходящие (handed) | ← Вернуть | 2 | да |
| В пути / Доставлено | Исходящие (handed) | — «📦 Доставка в процессе» | 2 | да |

Вкладки: Входящие = `myActivePos` + legacy `to==me`; Исходящие = `myHandedPos` + legacy `from==me`.

### Фильтр логиста

`GET /api/logist/orders` — карточки, где `positions.some({resp==имя})`; `include.positions.where {resp==имя}`. `LogistPortal` показывает позиции `resp==me & leg==2 & status≠Доставлено`. **Поэтому `leg` обязан быть верным для логиста** (его ставит сервер).

### Шкала прогресса (`PCT`, `lib/orderMetrics.ts`)

| Статус | % |
|---|---|
| В работе | 10 |
| Принято филиалом | 40 |
| Готово к отгрузке | 60 |
| В пути | 80 |
| Доставлено | 100 |
| (пусто) | 0 |

`cardProgress(o)` = среднее `posPct` по позициям (или 100/0 по статусу карты если позиций нет). `cardSum(o)` = Σ `qty*price`.

---

## 5. Отчёты смен логиста

- **Черновик** (`DailyReport.status='draft'`) — один на логиста в день. День = **Asia/Almaty 00:00** как UTC-инстант (`lib/reportDay.ts` `almatyDay()`). ⚠ Не использовать `new Date('YYYY-MM-DD')` (это UTC-полночь — дрейф дня).
- **Автострока**: когда позиция логиста становится «Доставлено», `LogistPortal` добавляет строку (`fromWho`=поставщик, `toWho`=клиент, `name`, `qty`). Автосейв черновика — POST `/api/reports/draft` (upsert по дню, полная замена rows).
- **Откат строки**: при возврате позиции из «Доставлено» назад сервер (`updatePos` §3.1a) удаляет строку из сегодняшнего draft; если смена закрыта — не трогает.
- **Закрытие/сдача**: логист сдаёт смену POST `/api/reports/daily` → создаётся отчёт `status='processing'`, уведомление бухгалтерам. Бухгалтер меняет статус PUT `/api/reports/daily/:id` (`processing`→`done`/`archive`).
- **Бух-сверка**: экран «Бухгалтерия» → вкладки Отчёты/Смены; фильтр `active`/`done`/`archive`.

---

## 6. Real-time

- **Транспорт-слой** `lib/live.ts`: интерфейс `LiveTransport.subscribe(channel, onSignal)`. Реализации: `PusherTransport` (+ страховочный `PollingTransport` 20с) при наличии `NEXT_PUBLIC_PUSHER_KEY`, иначе чистый `PollingTransport` 10с. Приложение собирается и работает **без Pusher-ключей** (fallback-поллинг).
- **Хук** `useLiveData(channel, load, deps, pausedRef?)`: грузит при монтировании + по сигналу; при `pausedRef.current` сигнал копится (`pending`) и применяется после снятия паузы (флаш раз в 1с). `PollingTransport` также дёргает `load` при visibilitychange/focus/online.
- **Сервер** `lib/pusherServer.ts`: `getServerPusher()` (singleton, `null` без env); `pushSignal(channel)` — **async**, `await` с гонкой-таймаутом 2.5с. **⚠ Обязательно `await pushSignal(...)` после ВСЕХ записей БД, перед `return`** — на Vercel serverless функция «замерзает» после ответа, fire-and-forget не долетает.
- **Каналы и точки сигнала**:

| Канал | Кто слушает | Роуты, шлющие сигнал |
|---|---|---|
| `orders` | AdminApp(loadLive: orders+notifs+dashboard), портал/клиент | `orders/:id/action`, `orders` POST, `orders/all` POST, `client/orders` POST, `track/submit`, `track/change`, `users/:id` PUT/DELETE |
| `reports` | AdminApp(экран бухгалтерии), логист | `reports/draft` POST/DELETE, `reports/daily` POST, `reports/daily/:id` PUT, `users/:id` DELETE |
| `settings` | AdminApp (loadSettings) | `projects` POST/PUT, `spec-projects` POST/PUT, `nomenclature` POST/PUT/DELETE, `users` POST, `users/:id` PUT/DELETE |

- **Паузы редактирования** (`editingRef`): пока филиал/логист редактирует позицию, live-обновление паузится (иначе перерисовка сбросит ввод/фокус). Ref не должен залипать: снимается при закрытии редактора / смене вкладки / размонтировании.

⚠ `NomenclatureScreen` пока **не подписан** на `settings` — правки номенклатуры прилетают в админ-селекты, но список номенклатуры на его экране обновляется вручную.

---

## 7. Безопасность

- **`requireSession(req, roles?)`** (`lib/auth.ts`) — единый гард API: нет сессии → 401 «Не авторизован»; `roles` не совпал → 403 «Нет доступа». Возвращает `{ ok, session?, response? }`.
- **JWT** (`jose`, HS256, cookie `ukan_session`, 7 дней, секрет `AUTH_SECRET`). **Fallback роли**: если в старом токене нет `role`, `requireSession` подтягивает роль из БД по `id` (динамический импорт prisma — Edge middleware не затрагивается). **⚠ `getSession()`** (для Server Components, напр. `/admin` страница) этого fallback **НЕ делает** — отдаёт роль как в токене; поэтому клиентские гейты не должны критично зависеть от `user.role` (был баг: пустая роль блокировала правку цены).
- **Middleware** (`middleware.ts`, Edge): публичны `/login`,`/register`,`/track`,`/api/auth`,`/api/track`,`/api/client`,`/api/nomenclature`, `/client/*`,`/rsp/*`,`/warehouse/*`,`/`; остальное без сессии → редирект на `/login`. Использует `getSessionFromRequest` (без prisma — edge-safe).

### Роли по роутам

| Роут | Метод | Гард |
|---|---|---|
| `auth/login`,`auth/phone`,`auth/register` | POST | публичные (проверка пароля/телефона) |
| `auth/me` | GET | requireSession |
| `orders`, `orders/all`, `orders/:id/action`, `orders/:id/history`, `dashboard`, `client/orders`, `settings`, `stock`, `stock/movements`, `notifications`, `spec-projects`(GET), `projects`(GET), `spec-projects/:id/analysis` | GET/POST | requireSession (любой авторизованный) |
| `branch/orders` | GET | requireSession `['branch']` |
| `logist/orders` | GET | requireSession `['logist']` |
| `users`(GET), `reports/daily`(GET) | GET | `['super_admin','bookkeeper']` |
| `nomenclature` POST/PUT/DELETE, `projects`/`spec-projects` POST/PUT | | `['super_admin','bookkeeper']` |
| `users` POST, `users/:id` PUT/DELETE | | `session.role==='super_admin'` |
| `reports/daily/:id` PUT | | `['super_admin','bookkeeper']` |
| `reports/daily` POST, `reports/draft` * | | `role==='logist'` / любой авторизованный |
| `stock/income` POST | | `role==='super_admin'` |
| `notifications/:id/read` PUT | | requireSession + **scope по `userId`** |
| `nomenclature`(GET), `track/*` | GET/POST | публичные (поиск / трекинг) |

### Что закрыто в security-коммите A (`064c5b4`)

1. **Утечка паролей**: `users` GET и `settings` GET теперь `select` без `password` (id,name,phone,email,role,companyId,slug,active,createdAt); `settings` отдаёт `users` только `super_admin`/`bookkeeper`, остальным `users:[]`.
2. **Номенклатура**: POST/PUT/DELETE теперь `['super_admin','bookkeeper']` (было — любой авторизованный мог удалять справочник).
3. **IDOR уведомлений**: `notifications/:id/read` — `updateMany where {id, userId: session.id}` (чужое пометить нельзя).
4. **Проекты/спецпроекты**: POST/PUT — роли `['super_admin','bookkeeper']`.

---

## 8. API-справочник

| Роут | Методы | Вход | Что делает |
|---|---|---|---|
| `/api/auth/login` | POST | email,password | JWT-cookie |
| `/api/auth/phone` | POST | phone | вход по телефону |
| `/api/auth/register` | POST | данные | регистрация |
| `/api/auth/me` | GET | — | текущая сессия |
| `/api/auth/logout` | POST | — | сброс cookie |
| `/api/orders` | GET/POST | POST: карточка (+`screen`, позиции) | список / создание (при `screen=outgoing` — гард комплектности) |
| `/api/orders/all` | GET/POST | — | все заказы / «провести все в бухгалтерию» |
| `/api/orders/:id/action` | POST | `{action, ...payload}` | диспетчер TRANSITIONS (§3) |
| `/api/orders/:id/history` | GET | — | лента истории |
| `/api/client/orders` | GET/POST | POST: `{to,text}` | заявки клиента/филиала (from по сессии) |
| `/api/branch/orders`, `/api/logist/orders` | GET | — | карточки филиала / логиста |
| `/api/dashboard` | GET | — | сводка (счётчики экранов, оборот) |
| `/api/settings` | GET | — | users(по роли)/projects/specProjects/suppliers/paymentStatuses |
| `/api/users` | GET/POST | POST: пользователь | список(без password) / создание + accessUrl |
| `/api/users/:id` | PUT/DELETE | PUT: поля | правка (каскад ренейма in from/to/resp) / удаление (чистит связи) |
| `/api/projects`, `/api/spec-projects` | GET/POST/PUT | | справочники проектов |
| `/api/spec-projects/:id/analysis` | GET | — | сверка сметы (собрано vs нужно) |
| `/api/nomenclature` | GET/POST/PUT/DELETE | GET: `?q`/`?all`/`?group` | поиск/CRUD номенклатуры |
| `/api/stock`, `/api/stock/movements` | GET | — | остатки / движения |
| `/api/stock/income` | POST | `{name,qty,unit}` | ручной приход на Центр Склад |
| `/api/reports/daily` | GET/POST | POST: `{date,comment,rows}` | список / сдать смену |
| `/api/reports/daily/:id` | PUT | `{status}` | смена статуса отчёта |
| `/api/reports/draft` | GET/POST/DELETE | `{rows,date?}` / `?scope=past` | черновик смены (автосейв) |
| `/api/notifications` | GET | — | уведомления пользователя |
| `/api/notifications/:id/read` | PUT | — | пометить прочитанным (scope по userId) |
| `/api/track` | GET | `?id` | публичный трекинг (стадия, %, позиции, cancelled) |
| `/api/track/submit` | POST | заявка (zod) | публичная подача заявки |
| `/api/track/change` | POST | `{cardId,changeText,changePhone}` (zod) | публичное «внести изменение» |

---

## 9. Формулы и константы

- **`lib/orderStatus.ts`**: `POS_STATUS` (working/readyToShip/inTransit/delivered/acceptedByBranch/empty), `CARD_STATUS` (accepted/processing/working/delivered/toAccount/bookkeeping/waiting/cancelled/archive), `SCREENS` (reception/outgoing/incoming/accounting/bookkeeping/archive). Единый источник строковых литералов.
- **`lib/orderMetrics.ts`**: `PCT`, `posPct`, `cardProgress`, `cardSum`, `orderInclude` (`{ positions: { orderBy: { createdAt:'asc' } } }`). Серверо-нейтральный (без React/Prisma).
- **`lib/reportDay.ts`**: `almatyDay(dateStr?)` → `{dayKey, nextKey}` границы дня Алматы.
- **`lib/dates.ts`**: `todayLocal()` — сегодня в локальной TZ (для дефолтов дат в формах).
- **ID-форматы** (`lib/ids.ts`): карта `C-NNN-ddmmyy`, проект `PRJ-NNN-ddmmyy`, спецпроект `СП-NNN-ddmmyy`, позиция `<cardId>-P<n>`, трек-ссылка `<base>/track?id=<cardId>`, `generateSlug` (транслит кириллицы), `normalizePhone` (`+7…`).

### Известные ⚠ особенности (сводно)

1. `Order.leg` — мёртвое поле (используется per-position `Position.leg`).
2. `getSession()` (страницы) не подтягивает роль из БД — только `requireSession` (API).
3. `track/submit` пишет статус `«Новая заявка»` — литерал вне `CARD_STATUS` (STAGES трекинга его учитывает как стадию 1).
4. `companyId`/суб-пользователи — бэкенд есть, UI-формы нет.
5. NAV админки не фильтруется по роли — bookkeeper видит все экраны (ограничения только на сервере).
6. `NomenclatureScreen` не подписан на live-канал `settings`.
7. Экран «Детали проекта» — кнопка убрана (кандидат на фичу).
8. Роль `warehouse_manager` осиротела в UI.
