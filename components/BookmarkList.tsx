'use client'

import { useEffect, useState } from 'react'
import { Trash2, ExternalLink, Bookmark } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import type { RealtimeChannel } from '@supabase/supabase-js'

type BookmarkType = Database['public']['Tables']['bookmarks']['Row']

interface BookmarkListProps {
  userId: string
}

export default function BookmarkList({ userId }: BookmarkListProps) {
  const [bookmarks, setBookmarks] = useState<BookmarkType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected')
  const supabase = createBrowserClient()

  // Fetch bookmarks
  useEffect(() => {
    fetchBookmarks()
  }, [userId])

  // Set up real-time WebSocket subscription
  useEffect(() => {
    let channel: RealtimeChannel

    const setupRealtimeSubscription = async () => {
      console.log('🔌 Setting up WebSocket subscription for user:', userId)

      // Create a unique channel name with timestamp to avoid conflicts
      const channelName = `bookmarks:${userId}:${Date.now()}`

      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes' as any,
          {
            event: '*',
            schema: 'public',
            table: 'bookmarks',
            filter: `user_id=eq.${userId}`,
          },
          (payload: any) => {
            console.log('📡 WebSocket event received:', payload)

            if (payload.eventType === 'INSERT') {
              console.log('➕ Adding new bookmark:', payload.new)
              setBookmarks((prev) => {
                const exists = prev.some((b) => b.id === payload.new.id)
                if (exists) {
                  console.log('⚠️ Bookmark already exists, skipping')
                  return prev
                }
                return [payload.new as BookmarkType, ...prev]
              })
            } else if (payload.eventType === 'DELETE') {
              console.log('🗑️ Removing bookmark:', payload.old.id)
              setBookmarks((prev) => prev.filter((b) => b.id !== payload.old.id))
            } else if (payload.eventType === 'UPDATE') {
              console.log('📝 Updating bookmark:', payload.new.id)
              setBookmarks((prev) =>
                prev.map((b) => (b.id === payload.new.id ? (payload.new as BookmarkType) : b))
              )
            }
          }
        )
        .subscribe((status: string) => {

          setConnectionStatus(status)

          if (status === 'SUBSCRIBED') {
            console.log('WebSocket connected and subscribed!')
          } else if (status === 'CHANNEL_ERROR') {
            console.error('WebSocket channel error!')
          } else if (status === 'TIMED_OUT') {
            console.error('WebSocket connection timed out!')
          } else if (status === 'CLOSED') {
            console.log(' WebSocket connection closed')
          }
        })
    }

    setupRealtimeSubscription()

    return () => {
      if (channel) {
        console.log('🔌 Cleaning up WebSocket subscription')
        supabase.removeChannel(channel)
      }
    }
  }, [userId])

  const fetchBookmarks = async () => {
    try {
      console.log('📥 Fetching bookmarks for user:', userId)
      const { data, error } = await supabase
        .from('bookmarks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      console.log('✅ Fetched bookmarks:', data?.length || 0)
      setBookmarks(data || [])
    } catch (error) {
      console.error('❌ Error fetching bookmarks:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this bookmark?')) return

    setDeletingId(id)
    try {
      console.log('🗑️ Deleting bookmark:', id)
      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
      console.log('✅ Bookmark deleted successfully')

      // OPTIMISTIC UPDATE: Remove from local state immediately for better UX
      // This ensures the UI refreshes even if WebSocket is slow
      setBookmarks((prev) => prev.filter((b) => b.id !== id))
    } catch (error) {
      console.error('❌ Error deleting bookmark:', error)
      alert('Failed to delete bookmark. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <>
      {/* Connection Status Indicator */}


      {bookmarks.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Bookmark className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No bookmarks yet</h3>
          <p className="text-gray-600">Add your first bookmark using the form above!</p>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            My Bookmarks ({bookmarks.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {bookmarks.map((bookmark) => (
              <div
                key={bookmark.id}
                className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-medium text-gray-900 line-clamp-2 flex-1">
                    {bookmark.title}
                  </h3>
                  <button
                    onClick={() => handleDelete(bookmark.id)}
                    disabled={deletingId === bookmark.id}
                    className="text-red-600 hover:text-red-700 disabled:text-red-400 transition-colors p-1"
                    title="Delete bookmark"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <a
                  href={bookmark.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1 break-all"
                >
                  <ExternalLink size={14} />
                  <span className="line-clamp-1">{bookmark.url}</span>
                </a>
                <p className="text-xs text-gray-500 mt-2">
                  Added {new Date(bookmark.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}