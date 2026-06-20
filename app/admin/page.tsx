// app/admin/page.tsx
import { getSession } from '@/lib/auth'
import AdminApp from '@/components/AdminApp'

export default async function AdminPage() {
  const session = await getSession()
  return <AdminApp user={session!} />
}
