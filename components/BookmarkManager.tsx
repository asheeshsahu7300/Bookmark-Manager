'use client'

import { createBrowserClient } from '@/lib/supabase'
import BookmarkForm from './BookmarkForm'
import BookmarkList from './BookmarkList'

interface BookmarkManagerProps {
  userId: string
}

export default function BookmarkManager({ userId }: BookmarkManagerProps) {
  const supabase = createBrowserClient()

  const handleAddBookmark = async (title: string, url: string) => {
    const { error } = await supabase
      .from('bookmarks')
      .insert({ title, url, user_id: userId })

    if (error) throw error
  }

  return (
    <>
      <BookmarkForm onAddBookmark={handleAddBookmark} />
      <BookmarkList userId={userId} />
    </>
  )
}
