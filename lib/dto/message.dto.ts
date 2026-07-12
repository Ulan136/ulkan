import { z } from 'zod'

// POST /api/orders/:id/messages — текст сообщения чата.
// trim + непустой + до 2000 символов. Пустые не проходят.
export const messageSchema = z.object({
  text: z.string().trim().min(1, 'Введите сообщение').max(2000, 'Слишком длинное сообщение'),
})
