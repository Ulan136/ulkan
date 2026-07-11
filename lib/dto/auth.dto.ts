import { z } from 'zod'

// POST /api/auth/login — читает email, password (оба обязательны).
// Формат email НЕ проверяем: роут сейчас ищет пользователя по строке как есть.
export const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
})

// POST /api/auth/phone — читает phone (обязателен). Нормализация — в normalizePhone.
export const phoneSchema = z.object({
  phone: z.string().min(1),
})

// POST /api/auth/register — читает name, phone (обязательны) + email (опционально,
// в роуте `email || null`). nullish → string | null | undefined, как сейчас.
export const registerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().nullish(),
})
