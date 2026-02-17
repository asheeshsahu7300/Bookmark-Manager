'use client'

import { LogOut, Bookmark } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface HeaderProps {
  userEmail?: string
}

export default function Header({ userEmail }: HeaderProps) {
  const supabase = createBrowserClient()
  const router = useRouter()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.refresh()
  }

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bookmark className="text-blue-600" size={28} />
          <h1 className="text-2xl font-bold text-gray-900">Bookmark Manager</h1>
        </div>
        {userEmail && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{userEmail}</span>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
