import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import BranchPortal from '@/components/BranchPortal'
import prisma from '@/lib/prisma'

export default async function BranchPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await getSession()
  if (!session) redirect(`/login?from=/branch/${slug}`)

  const user = await prisma.user.findUnique({ where: { slug } })
  if (!user) redirect('/')
  if (user.role !== 'branch') redirect('/')

  return <BranchPortal user={session} branchUser={user as any} />
}
