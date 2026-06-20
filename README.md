# U-Kan · Система логистики

## Стек

- **Frontend + Backend:** Next.js 15 (App Router) + TypeScript
- **База данных:** PostgreSQL (через Prisma ORM)
- **Хостинг:** Vercel (фронт) + Neon или Supabase (БД, бесплатно)
- **Аутентификация:** JWT cookies (без сторонних провайдеров)

---

## Быстрый старт

### 1. Установить зависимости

```bash
npm install
```

### 2. Настроить базу данных

**Вариант A — Neon (бесплатно, рекомендуется):**
1. Зарегистрируйся на [neon.tech](https://console.neon.tech)
2. Создай проект → скопируй `Connection string`

**Вариант B — Supabase:**
1. Зарегистрируйся на [supabase.com](https://app.supabase.com)
2. Создай проект → `Settings → Database → Connection string`

### 3. Создать .env.local

```bash
cp .env.example .env.local
```

Заполни `.env.local`:
```env
DATABASE_URL="postgresql://..."   # строка из Neon/Supabase
AUTH_SECRET="любая-длинная-строка-32-символа+"
NEXTAUTH_URL="http://localhost:3000"
```

### 4. Создать таблицы и заполнить тестовыми данными

```bash
npm run db:generate   # генерация Prisma клиента
npm run db:push       # создать таблицы в БД
npm run db:seed       # добавить тестовые данные
```

### 5. Запустить локально

```bash
npm run dev
```

Открой: http://localhost:3000
Войди: `admin@u-kan.kz` / `admin123`

---

## Деплой на Vercel

1. Запушь код в GitHub
2. Зайди на [vercel.com](https://vercel.com) → Import project
3. В разделе `Environment Variables` добавь:
   - `DATABASE_URL` — строка подключения к Neon/Supabase
   - `AUTH_SECRET` — секретный ключ (минимум 32 символа)
   - `NEXTAUTH_URL` — твой домен (например, `https://u-kan.vercel.app`)
4. Deploy!

После деплоя выполни миграцию БД:
```bash
# Локально с production DATABASE_URL:
DATABASE_URL="your-production-url" npm run db:push
DATABASE_URL="your-production-url" npm run db:seed
```

---

## Страницы

| URL | Описание |
|-----|---------|
| `/` | Редирект на `/admin` |
| `/login` | Вход в систему |
| `/admin` | Главная админка |
| `/track?id=C-xxx` | Публичная страница трекинга |

---

## API Endpoints

| Метод | URL | Описание |
|-------|-----|---------|
| POST | `/api/auth/login` | Вход |
| POST | `/api/auth/logout` | Выход |
| GET | `/api/auth/me` | Текущая сессия |
| GET | `/api/orders/all` | Все заказы |
| POST | `/api/orders` | Создать заказ |
| POST | `/api/orders/[id]/action` | Действие над заказом |
| GET | `/api/dashboard` | Данные дашборда |
| GET | `/api/settings` | Справочники |
| GET | `/api/track?id=` | Публичный трекинг |

---

## Структура таблиц

```
User         — администраторы и ответственные
Client       — заказчики
Supplier     — поставщики
Nomenclature — номенклатура 1С
Project      — проекты (PRJ-xxx-DDHHMMYY)
Order        — заказы (C-xxx-DDHHMMYY)
Position     — позиции заказа (C-xxx-P1, P2...)
History      — история действий
```

---

## Поток карточек

```
Входящие → Приёмка (Ожидание) → Приёмка (Стол) → Исходящие → К Учёту → Бухгалтерия → Архив
```

---

## Смена пароля

```bash
# В консоли Node.js или через Prisma Studio (npm run db:studio)
import bcrypt from 'bcryptjs'
const hash = await bcrypt.hash('новый_пароль', 10)
# Обновить поле password у нужного пользователя
```
