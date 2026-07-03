import prisma from './prisma'

export async function notify(userId: string, text: string, cardId?: string) {
  await prisma.notification.create({ data: { userId, text, cardId } })
}

export async function notifyAdmins(text: string, cardId?: string) {
  const admins = await prisma.user.findMany({ where: { role: 'super_admin', active: true } })
  for (const admin of admins) await notify(admin.id, text, cardId)
}

export async function notifyBookkeepers(text: string) {
  const bks = await prisma.user.findMany({ where: { role: 'bookkeeper', active: true } })
  for (const b of bks) await notify(b.id, text)
}
