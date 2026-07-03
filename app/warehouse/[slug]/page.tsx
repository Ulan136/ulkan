import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import WarehousePortal from '@/components/WarehousePortal'

export default async function WarehousePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await getSession()
  if (!session) redirect(`/login?from=/warehouse/${slug}`)
  if (!['super_admin', 'warehouse_manager'].includes(session.role)) redirect('/')

  const user = await prisma.user.findUnique({ where: { slug } })
  if (!user) redirect('/')

  return <WarehousePortal user={session} />
}
