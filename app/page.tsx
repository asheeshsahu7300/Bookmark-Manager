import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Header from '@/components/Header'
import BookmarkManager from '@/components/BookmarkManager'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const cookieStore = cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  const userId = session.user.id
  const userEmail = session.user.email

  return (
    <>
      <Header userEmail={userEmail} />
      <main className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <BookmarkManager userId={userId} />
        </div>
      </main>
    </>
  )
}
