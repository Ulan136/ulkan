import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import LogistPortal from '@/components/LogistPortal'

type Props = { params: Promise<{ slug: string }> }

export default async function RspPage({ params }: Props) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'logist') redirect('/')
  const { slug } = await params
  if (session.slug && session.slug !== slug) redirect(`/rsp/${session.slug}`)
  return <LogistPortal user={session} />
}