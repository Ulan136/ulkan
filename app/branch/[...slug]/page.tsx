import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import BranchPortal from '@/components/BranchPortal'
import prisma from '@/lib/prisma'

export default async function BranchPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params
  const full = slug.join('/')
  const last = slug[slug.length - 1]
  const session = await getSession()
  if (!session) redirect(`/login?from=/branch/${full}`)

  // Терпимый поиск: и по полному slug со слэшем, и по последнему сегменту
  const user = await prisma.user.findFirst({
    where: { OR: [{ slug: full }, { slug: last }] },
  })
  if (!user) redirect('/')
  if (user.role !== 'branch') redirect('/')

  return <BranchPortal user={session} branchUser={user as any} />
}
