import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ClientApp from '@/components/ClientApp'

type Props = { params: Promise<{ slug: string }> }

export default async function ClientPage({ params }: Props) {
  const session = await getSession()
  if (!session) redirect('/track')
  if (!['client', 'supplier_client'].includes(session.role)) redirect('/')
  const { slug } = await params
  if (session.slug && session.slug !== slug) redirect(`/client/${session.slug}`)
  return <ClientApp user={session} />
}