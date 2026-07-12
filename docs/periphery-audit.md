# Ревизия периферии проекта

Аудит областей, которых НЕ касался рефакторинг ядра (workflow заказов, плечи, порталы, отчёты смен). Цель — найти старые паттерны, которые в ядре уже вылечили. **Кода не меняли, только отчёт.**

Каждая находка: `файл:строка — что не так — судьба (удалить / починить / оставить)`.

Ищем известные болезни:
**a)** мёртвый код · **b)** битые связки id/имя · **c)** устаревшие условия (мёртвый `Order.leg`, старые статусы/поля) · **d)** локальные копии логики (прогресс/суммы мимо `orderMetrics`, статусы мимо `orderStatus`) · **e)** отсутствие `pushSignal` · **f)** гарды (роли/`requireSession`) · **g)** UTC-даты · **h)** `any` и хрупкие `Number(x)||0`.

Канонические «лекарства»: `lib/orderMetrics.ts` (cardProgress/cardSum/posPct/PCT), `lib/orderStatus.ts` (POS_STATUS/CARD_STATUS/SCREENS), `lib/auth.ts` requireSession, `lib/pusherServer.ts` pushSignal, `lib/reportDay.ts` almatyDay, `lib/dates.ts` todayLocal. Поле `Order.leg` (на карточке) — мёртвое; живёт `Position.leg` (per-position).

> ⚠️ 4 самые опасные находки проверены вручную (подтверждены): утечка паролей в `users`/`settings` GET, IDOR в `notifications/[id]/read`, отсутствие ролевого гарда в `nomenclature` POST/PUT/DELETE.

---

## 1. Проекты (PRJ) и СпецПроекты (СП)

**a) Мёртвый код**
- `components/AdminApp.tsx:518,1951` — `setShowProjectDetail(p)` вызывается по клику на строку проекта (курсор pointer), но **блока рендера `{showProjectDetail && …}` нет** — клик молча ничего не делает — **починить** (добавить модалку) или убрать onClick.
- `components/AdminApp.tsx:465` — `editingSpec`/`setEditingSpec` объявлены, никогда не читаются и не пишутся — **удалить**.
- `lib/api.ts:36 / AdminApp.tsx:5` — `updateProject` импортирован, но не вызывается; PUT `/api/projects` недостижим из UI (архивировать проект нечем) — **починить** (подключить) или удалить endpoint.
- `lib/api.ts:41 / AdminApp.tsx:6` — `updateSpecProject` импортирован, не вызывается; тот же мёртвый путь архивации СП — **починить/удалить**.
- `lib/api.ts:34,39` — `fetchProjects` / `fetchSpecProjects` экспортированы, нигде не импортируются (данные приходят через `fetchSettings`) — **удалить**.

**b) Битые связки id/имя**
- `app/api/spec-projects/[id]/analysis/route.ts:21` — `p.name1c === item.name || p.oral === item.name`: сопоставление позиции со сметной строкой по точному имени без `.trim()/.toLowerCase()` → любое расхождение регистра/пробела молча теряет собранное кол-во (0 собрано / 100% осталось) — **починить**.
- (проверено: `find(u => u.id === p.clientId)` на 1955/1978 — корректная связка id↔id.)

**c) Устаревшие условия** — чисто. `status === 'active'/'archive'` — это lifecycle проекта, не CARD_STATUS.

**d) Локальные копии логики**
- `components/AdminApp.tsx:1980` — `<ProgressBar pct={0} />` в таблице СП: прогресс жёстко 0% для всех спецпроектов — **починить** (считать реальный %).
- `app/api/spec-projects/[id]/analysis/route.ts:24` — `Math.round(Math.min(collected/item.qty*100,100))` — это метрика «собрано vs нужно», отдельная от cardProgress → в orderMetrics не место — **оставить**.

**e) Нет pushSignal**
- `app/api/projects/route.ts:20 (POST), :31 (PUT)` — мутируют Project, сигнала нет — **починить**.
- `app/api/spec-projects/route.ts:20 (POST), :39 (PUT)` — мутируют SpecProject(+items), сигнала нет — **починить**.

**f) Гарды**
- `app/api/projects/route.ts:16,27` и `app/api/spec-projects/route.ts:16,35` — все мутации `requireSession(req)` **без ролей** → любой авторизованный (в т.ч. client) может создавать/архивировать проекты — **починить** (роли).

**g) UTC** — чисто.

**h) any / Number**
- `app/api/spec-projects/route.ts:25` — `items.map((i: any) => …)`, `i.qty` пишется в БД без валидации — **починить**.
- `components/AdminApp.tsx:721` — `qty: Number(i.qty) || 0`: нечисло → тихий 0 в смете — **починить**.
- `components/AdminApp.tsx:1956,1979` — `(p as any)._count?.orders` / `(sp as any)._count` — `any`-каст к полю, которого нет в типе — **починить** (расширить тип).
- (корректность) `app/api/spec-projects/[id]/analysis/route.ts:14,20` — `sp.orders` берёт ВСЕ заказы без фильтра отменённых/черновиков → собранное считает и по отменённым — **проверить**.

---

## 2. Настройки: пользователи, оплата, номенклатура

**a) Мёртвый код**
- `components/AdminApp.tsx:459,2149` — модалка «Создать карточку»: `setShowCreateCard(true)` не вызывается нигде (только `false`) → модалка + `handleCreateCard` (:677) + `useEffect([showCreateCard])` (:554) мертвы; primary-кнопка :2177 имеет пустой `onClick={()=>{}}` — **удалить**. *(известный пример-эталон)*
- `components/AdminApp.tsx:472,2327` — модалка «Добавить в номенклатуру»: `setShowNomAdd(true)` не вызывается → модалка + `handleNomCreate` (:489) мертвы — **удалить**.
- `components/AdminApp.tsx:470,500` — `nomEditItem` только сбрасывается в null (:504), UI его не ставит → `handleNomUpdate` недостижим; `handleNomDelete` (:510) вообще не упоминается — **удалить**.
- `components/AdminApp.tsx:468-473,661` — локальные `nomSearch/nomGroup/nomList/loadNomList`: экран номенклатуры рендерит `<NomenclatureScreen/>`, это состояние вытеснено и не рендерится — **удалить**.
- `components/AdminApp.tsx:526-527,659` — `stock/stockMovements` в AdminApp заполняются, но склад рендерит `<WarehouseScreen/>` → мертвы — **удалить**.
- `components/AdminApp.tsx:1508` — алиас `outTab/setOutTab`: `setOutTab` не используется (напрямую `setOutgoingTab`) — **удалить**.
- `app/api/users/route.ts:20,38` + `users/[id]:22` — `companyId` принимается и пишется, но **ни одна форма его не шлёт** (в create/edit модалках поля компании нет) → назначение суб-пользователя недостижимо; колонка «КОМПАНИЯ» (:1907) и `subUsers` (:1029) всегда пусты — **починить** (добавить UI) или знать, что осиротело.
- `components/AdminApp.tsx:2194` — роль `warehouse_manager` есть в create-списке, но нет в `roleLabel/roleColors` (:1870) и в edit-списке (:2240) → такой юзер без цвета и его нельзя переназначить — **починить**.

**b) Битые связки id/имя** — чисто (все `find(x => x.id === …)` по id).

**c) Устаревшие условия** — чисто (каскад ренейма `[id]/route.ts:32-49` трогает живые from/to/resp).

**d) Локальные копии**
- `app/api/users/route.ts:44-46` — `accessUrl` (client/supplier_client→/client, logist→/rsp, **без branch**) расходится с копией в `AdminApp.tsx:1902` (там есть branch→/branch) → создание branch-юзера возвращает пустой accessUrl — **починить** (общий хелпер).

**e) Нет pushSignal**
- `app/api/users/[id]/route.ts:60-81 (DELETE)` — обнуляет `order.contactId`, чистит dailyReport/notification, но сигнала нет (PUT на :52 шлёт) — **починить** (`pushSignal('orders')`+`'reports'`).
- `app/api/users/route.ts:48 (POST)` — создание юзера без сигнала (настройки перезагружаются вручную — ниже приоритет) — **починить/оставить**.

**f) Гарды — 🔴 КРИТИЧНО (утечка данных)**
- `app/api/users/route.ts:10 (GET)` — `prisma.user.findMany()` **без `select` и без ролей** → любой авторизованный (client/logist/branch) получает ВСЕ записи юзеров, включая **bcrypt-хэш пароля**, телефон, email — **починить** (роль + `select` без password). **Подтверждено.**
- `app/api/settings/route.ts:10 (GET)` — та же `prisma.user.findMany()` (полные записи с хэшем) любому авторизованному — **починить** (`select`). **Подтверждено.**
- (мутации ок: POST/PUT/DELETE требуют `super_admin`, self-delete заблокирован :68, пароли хэшируются.)

**g) UTC** — чисто.

**h) any / Number**
- `app/api/users/[id]/route.ts:15` — `const updateData: any = {}` в мутирующем роуте — **починить**.
- `components/AdminApp.tsx:692` — `createUser(newUser) as any` → `.user/.accessUrl` без типа — **починить**.

---

## 3. Склад (WarehouseScreen + stock-роуты)

**a) Мёртвый код** — чисто (IncomeModal :220 и add-модалка :322 рендерятся, обработчики подключены). `NomenclatureScreen.tsx:257` — неиспользуемый индекс `i` в map — **оставить** (косметика).

**b) Битые связки id/имя**
- `components/NomenclatureScreen.tsx:81` — `search.toLowerCase()` без `.trim()` → хвостовые пробелы из вставки не находят ничего — **починить** (мелочь).
- `NomenclatureScreen.tsx:82-84` — `item.group===selGroup && item.cat===selCat && item.subgroup===selSubgroup` — точное равенство без trim, завязано на побайтовое совпадение с деревом — **оставить** (контракт данных, следить).
- (stock join по `name` — каноничный ключ склада, не баг.)

**c) Устаревшие условия** — чисто (union типов движений `income|reserve|expense` совпадает с lib/stock).

**d) Локальные копии / литерал «Центр Склад»**
- `components/WarehouseScreen.tsx:108,225` — хардкод `'Центр Склад · ручной приход'` / `'🏭 Центр Склад'` вместо `CENTER_SKLAD` — **оставить** (клиентский компонент не может импортить services/stockOps → тянет prisma; но литерал продублирован — флажок).
- `app/api/stock/income/route.ts:18-19` — корректно использует `CENTER_SKLAD` — **оставить** (хорошо).
- `WarehouseScreen.tsx:285,306,322` — inline `qty - reserved` для KPI-отображения (не дубль orderMetrics) — **оставить**.

**e) Нет pushSignal**
- `app/api/nomenclature/route.ts:77 (POST), :88 (PUT), :100 (DELETE)` — мутируют номенклатуру, сигнала нет — **починить** (открытые списки не обновятся live).
- `app/api/stock/income/route.ts:21 (POST)` — мутирует склад/движения, сигнала нет (WarehouseScreen жмёт reload вручную) — **починить**.

**f) Гарды — 🔴 КРИТИЧНО**
- `app/api/nomenclature/route.ts:73-74 (POST), :84-85 (PUT), :95-96 (DELETE)` — только `if (!session)` **без роли** → любой авторизованный (client/branch/logist) может создавать/править/**удалять** номенклатуру. Плюс `getSessionFromRequest` вместо канонического `requireSession(req, roles)` — **починить** (роли, напр. super_admin). **Подтверждено.**
- `app/api/stock/income/route.ts:8-11` — гард `session.role !== 'super_admin'` (корректно), но мимо `requireSession` — **оставить/починить** (консистентность).
- `stock/route.ts`, `stock/movements/route.ts` — GET через `requireSession` — чисто.

**g) UTC** — чисто.

**h) any / Number**
- `app/api/stock/income/route.ts:14,21` — `{ name, qty, unit }` без типа; `Number(qty)` без NaN-гарда: `if (!name || !qty)` не ловит нечисловую строку → NaN в incomeStock — **починить** (`Number.isFinite`).

---

## 4. Уведомления

**a) Мёртвый код** — чисто (колокольчики AdminApp:2107, ClientApp:173/414 полностью подключены к read+refresh).

**e) Нет pushSignal**
- `lib/notifications.ts:3-15` — `notify/notifyAdmins/notifyBookkeepers` создают строки, но своего сигнала не шлют — доставка зависит целиком от того, толкнёт ли вызывающий `pushSignal('orders')` — **оставить** (дизайн-связка; прямое следствие — баг в track/change ниже).

**f) Гарды — 🔴 IDOR**
- `app/api/notifications/[id]/read/route.ts:10 (PUT)` — `notification.update({ where: { id } })` **не ограничен `session.id`** → любой авторизованный может пометить прочитанным ЧУЖОЕ уведомление (IDOR) — **починить** (добавить `userId: session.id` в where / updateMany). **Подтверждено.**
- `app/api/notifications/route.ts` — GET корректно по `session.id` — чисто.

---

## 5. Трекинг (TrackingApp) и лендинг

**a/c) Мёртвые / устаревшие статусы в публичном трекинге**
- `app/api/track/route.ts:5-9` — `STAGES` содержит ключи `'Принято филиалом'`, `'Готово к отгрузке'`, `'В пути'` — это **позиционные** статусы (POS_STATUS), а `order.status` ими не бывает → мёртвые ключи — **починить**.
- `app/api/track/route.ts:5-9,25` — `STAGES` **не содержит** реальных card-статусов `'К учёту'`, `'Бухгалтерия'`, `'Отменён'`; через `|| 1` (стр. 25) заказ в учёте/бухгалтерии/отменённый показывает клиенту стадию 1 («Заявка») — **починить** (маппить toAccount/bookkeeping).
- `app/api/track/submit/route.ts:34` — хардкод `status: 'Новая заявка'` — литерала нет в CARD_STATUS (каноничное ожидание = `'В ожидании'`) → статус-сирота — **починить**.
- `app/api/track/route.ts:29` — `p.leg === 1` — это **позиционный** leg (жив, schema:82), НЕ мёртвый card-level — **оставить**.

**d) Локальные копии**
- `app/api/track/route.ts:5-9` — `STAGES` хардкодит литералы статусов вместо derive из orderStatus — **починить**.
- `components/TrackingApp.tsx:15,18-24` — `STEPS`/`StatusBadge` дублируют лейблы и цвета статусов (несёт сироту `'Новая заявка'`) — **оставить** (только отображение, низкий риск).

**e) Нет pushSignal — заметный live-баг**
- `app/api/track/change/route.ts:12-17` — мутирует заказ (isChanged/changeText) + `notifyAdmins`, но **нет `pushSignal('orders')`** (в отличие от submit:40). Колокольчики admin/client слушают только канал `'orders'` → клиентские изменения и уведомление админу НЕ приходят в реалтайме — **починить**.

**f) Гарды**
- `app/api/track/change/route.ts:6-17` — публичный POST правит произвольный заказ по `cardId` без auth и без проверки существования; знающий cardId может спамить isChanged/changeText, несуществующий cardId → P2025 → 500 — **починить** (проверка существования / rate-limit; свойственно публичному трекингу).
- `track/route.ts`, `track/submit` — публичны by design, submit валидируется zod — **оставить**.

**g) UTC** — чисто (`track/route.ts:51` полный timestamp, `TrackingApp.tsx:197` display-only).

**h) any** — `TrackingApp.tsx:105,115` `as any`, `InstallPrompt.tsx:5,18` `any` на beforeinstallprompt — **оставить** (мелочь).

---

## 6. Модалки AdminApp — инвентаризация

| Модалка / оверлей | Флаг (объявл.) | Открывается | Рендер | Статус |
|---|---|---|---|---|
| Card detail | `selectedOrder` (442) | много мест (788,945,995,1485,…) | 2136 | LIVE |
| Notifications dropdown | `showNotifs` (445) | 2107 | 2111 | LIVE |
| **Create Card** | `showCreateCard` (459) | **никогда** | 2149 | **МЁРТВ** |
| Create Project | `showCreateProject` (460) | 1097, 1944 | 2262 | LIVE |
| Create SpecProject | `showCreateSpec` (461) | 1107, 1968 | 2286 | LIVE |
| Create User | `showCreateUser` (462) | 1894 | 2185 | LIVE |
| User-result | `showUserResult` (463) | 693 | 2213 | LIVE |
| SpecProject analysis | `showSpecAnalysis` (464) | 1982 | 2353 | LIVE |
| Edit User | `editingUser` (519) | 1916 | 2231 | LIVE |
| **Nomenclature add** | `showNomAdd` (472) | **никогда** | 2327 | **МЁРТВ** |
| **Project detail** | `showProjectDetail` (518) | 1951 | **нет блока** | **БИТА** (открывают — не рендерится) |
| Nomenclature edit | `nomEditItem` (470) | только =null | нет | **МЁРТВ** |
| SpecProject edit | `editingSpec` (465) | никогда | нет | **МЁРТВ-сирота** |
| Reception create | `recFormOpen` (533) | 1065 (инлайн-панель) | 1073 | LIVE |

Судьба мёртвых модалок и их обработчиков (`handleCreateCard`, `handleNomCreate`, `handleNomUpdate`, `handleNomDelete`, `editingSpec`, dead nom/stock-стейт) — **удалить**; `Project detail` — **починить** (добавить рендер) либо снять onClick.

---

## 7. Фильтр / канбан (FilterScreen)

**c) Устаревшие условия**
- `components/FilterScreen.tsx:363` — литерал `'Доставлено'` + `o.toacc` для фильтра «delivered» вместо констант orderStatus — **починить**.

**d) Локальные копии**
- `FilterScreen.tsx:45-53` — `StatusDot` со своей картой статус→цвет (дубль statusStyle/orderStatus) — **починить** (централизовать).
- `FilterScreen.tsx:299-302,433-438` — прогресс спец-элементов inline (`Math.round(Math.min(...))`), каноничного хелпера нет — **оставить**.

**e) Персистентность / pushSignal**
- `FilterScreen.tsx:347,484` — `cardOverrides` (перетаскивание карточки между колонками) пишется **только в локальный стейт**, `handleDragOver` не зовёт мутирующий API → перемещения не сохраняются, теряются на reload — **починить** или задокументировать как «виртуальная группировка».
- `FilterScreen.tsx:344,495` — `colOrder` (порядок колонок) локальный, без сохранения — **оставить** (view-preference).

**h) any / хрупкие депсы**
- `FilterScreen.tsx:367` — `useMemo(..., [orders, statusFilter])` **пропускает `dateFrom`/`dateTo`**, которые используются в теле (364-365) → фильтр по датам не переприменяется, пока не изменятся orders/status — **починить** (добавить деп).
- `FilterScreen.tsx:379,418,435` — сопоставления `p.supplier === s.name`, `p.name1c === item.name` без trim/lowercase — **оставить/следить**.

---

## Кросс-каттинг (dashboard, orders/all, libs)

**d) Локальные копии**
- `app/api/dashboard/route.ts:39-46` — inline-переизобретение `cardProgress()` (среднее posPct + `'Доставлено'?100:0`) вместо вызова canonical — **починить** (звать cardProgress).
- `app/api/dashboard/route.ts:27` — inline `p.qty * p.price` дублирует `cardSum()` и теряет его `|| 0`-гард (NaN при price=null) — **починить** (cardSum).
- `lib/display.ts:31-46` — `statusStyle` хардкодит полный набор литералов статусов (дубль значений orderStatus) — **починить** (ключи от констант).
- `components/LogistPortal.tsx:22-27` — `almatyTodayStr/almatyDateStr` — локальная копия almaty-логики из `lib/reportDay.ts` — **починить** (общий хелпер).
- `components/ClientApp.tsx:32` — локальный `fmtDateTime` дублирует `lib/display.ts:81` — **починить** (импорт canonical).
- Приватные статус-карты (другие владельцы, report-only): `BranchPortal.tsx:12,35,38`, `ClientApp.tsx:18`, `TrackingApp.tsx:21`, `AdminApp.tsx:359,1575` — **починить** (централизовать).

**e) Нет pushSignal**
- `app/api/orders/all/route.ts:22-26` — POST «провести все в бухгалтерию» делает `updateMany` (screen/status/toacc), но `pushSignal('orders')` нет → чужие доски не обновятся — **починить**.

**a) Мёртвый код в libs**
- `lib/cold-archive.ts:3` — `markColdArchive` не импортируется/не вызывается (нет крона/роута) — **удалить или подключить**.
- `lib/display.ts:13` — `primaryResp` не используется — **удалить**.
- `lib/api.ts:34,36,39,41` — `fetchProjects/updateProject/fetchSpecProjects/updateSpecProject` мёртвые (см. область 1) — **удалить/подключить**.

**g) UTC — реальный дрейф дня**
- `app/api/reports/daily/route.ts:25` — POST пишет `date: new Date(date)` (парсит `'YYYY-MM-DD'` как UTC-полночь), расходясь с каноничным `almatyDay(date).dayKey` из `reports/draft` → дрейф ключа дня для сохранённых отчётов — **починить** (almatyDay).
- `components/LogistPortal.tsx:23,26` — `toISOString().slice(0,10)`, но с добавленным `ALMATY_OFFSET` → корректный день Алматы, НЕ UTC-баг — **оставить** (но дедуп в reportDay, см. d).

**h) any**
- `app/api/reports/draft/route.ts:7-8` — `mapRows(rows: any): any[]` — **починить** (типизировать строку).
- `components/BranchPortal.tsx:88` — `fetch('/api/branch/orders')` мимо `lib/api.ts` (нет `res.ok`/обработки ошибок, нет `fetchBranchOrders`) — **починить** (обёртка).

---

## ТОП-5 по опасности

1. **🔴 Утечка паролей** — `app/api/users/route.ts:10` и `app/api/settings/route.ts:10`: `prisma.user.findMany()` без `select` и без ролей отдаёт bcrypt-хэши/телефоны/email ЛЮБОМУ авторизованному (client/logist/branch). *Подтверждено.*
2. **🔴 Нет ролевого гарда на номенклатуре** — `app/api/nomenclature/route.ts:73/84/95`: любой авторизованный может создавать/править/**удалять** справочник номенклатуры. *Подтверждено.*
3. **🔴 IDOR уведомлений** — `app/api/notifications/[id]/read/route.ts:10`: пометить прочитанным можно ЧУЖОЕ уведомление (update не ограничен `session.id`). *Подтверждено.*
4. **🟠 Публичный трекинг врёт стадию + не шлёт live** — `app/api/track/route.ts:5-9,25` (заказы в учёте/бухгалтерии/отменённые показывают клиенту «Заявка») и `track/change/route.ts` (изменения клиента и уведомление админу не приходят в реалтайме — нет `pushSignal`).
5. **🟠 Открытые мутации без ролей** — `projects`/`spec-projects` POST/PUT: `requireSession` без ролей → client может создавать/архивировать проекты. Плюс `orders/all` POST без `pushSignal`.

---

## Что чинить и как

**Коммит A — «security/guards» (высокий приоритет, маленький, изолированный):**
1. `users` GET + `settings` GET → `select` без `password` (+ роль на users GET).
2. `nomenclature` POST/PUT/DELETE → `requireSession(req, ['super_admin'])`.
3. `notifications/[id]/read` → `updateMany({ where: { id, userId: session.id } })`.
4. `projects`/`spec-projects` мутации → роли.
Всё — серверные роуты, без изменения UI, легко проверяется, максимальный эффект.

**Коммит B — «live/pushSignal» (низкий риск):**
Добавить `pushSignal` в: `orders/all` POST, `track/change` POST, `projects`/`spec-projects`/`users`/`nomenclature`/`stock/income` мутациях. Механическая правка, каждый — одна строка после записей БД.

**Коммит C — «track statuses» (узкий, но заметный клиенту):**
`track/route.ts` STAGES перевести на константы orderStatus + добавить toAccount/bookkeeping/cancelled; `track/submit` статус `'Новая заявка'` → `CARD_STATUS.waiting`.

**Коммит D — «dead code sweep» (чистка, отдельно):**
Удалить мёртвые модалки и обработчики AdminApp (Create Card, Nomenclature add/edit, nom/stock-стейт, editingSpec, outTab-алиас) + мёртвые экспорты (`primaryResp`, `fetchProjects/fetchSpecProjects`, при отсутствии подключения `markColdArchive`). **Отдельным коммитом** — велик по diff, но без риска поведения.

**Починить отдельно (нужен UI-разбор, не механика):**
- `Project detail` модалка (открывают — не рендерится): добавить блок или снять клик.
- `companyId`/суб-пользователи: осиротевший бэкенд без формы — решить, нужна ли фича.
- `FilterScreen` drag-persist (`cardOverrides` только локально) — решить: сохранять или пометить «виртуальная группировка».
- `FilterScreen:367` deps useMemo — быстрый фикс, но проверить связку с фильтром.

**НЕ трогать (осознанно оставить):**
- Клиентские литералы «Центр Склад» в `WarehouseScreen` (нельзя импортить prisma-сервис в клиент).
- `LogistPortal` almaty-`toISOString().slice(0,10)` (корректен со сдвигом; дедуп — по желанию).
- Inline-метрики спецпроектов (нет каноничного хелпера — своя метрика).
- Публичность `track` GET/submit (by design).
- Мелкие `any`/`Number(x)||0` в некритичных местах.

---

### Метод
Аудит выполнен 6 параллельными read-only агентами по областям; 4 самые опасные находки (утечка паролей, IDOR, гард номенклатуры) перепроверены вручную по исходникам. Кода не меняли.
