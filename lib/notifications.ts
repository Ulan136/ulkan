// lib/notifications.ts
import { prisma } from './prisma'

export async function notify(userId: string, text: string, cardId?: string) {
  try {
    await prisma.notification.create({ data: { userId, text, cardId } })
  } catch {}
}

export async function notifyAdmins(text: string, cardId?: string) {
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'super_admin', active: true },
      select: { id: true }
    })
    await Promise.all(admins.map(a => notify(a.id, text, cardId)))
  } catch {}
}

export async function notifyBookkeepers(text: string) {
  try {
    const bks = await prisma.user.findMany({
      where: { role: 'bookkeeper', active: true },
      select: { id: true }
    })
    await Promise.all(bks.map(b => notify(b.id, text)))
  } catch {}
}

export async function notifyUser(userId: string | null | undefined, text: string, cardId?: string) {
  if (!userId) return
  await notify(userId, text, cardId)
}
