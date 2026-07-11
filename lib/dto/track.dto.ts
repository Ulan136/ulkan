import { z } from 'zod'

// POST /api/track/submit — читает name, phone, text (все обязательны, truthy-строки).
// Нормализация телефона выполняется в роуте через normalizePhone — здесь только строка.
export const submitSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  text: z.string().min(1),
})

// POST /api/track/change — читает cardId (обязателен) + changeText/changePhone (опциональны,
// в роуте применяется `x || ''`). nullish → принимаем string | null | undefined, как сейчас.
export const changeSchema = z.object({
  cardId: z.string().min(1),
  changeText: z.string().nullish(),
  changePhone: z.string().nullish(),
})
