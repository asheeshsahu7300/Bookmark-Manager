'use client'

import { useState } from 'react'
import { Trash2, ExternalLink, Bookmark, Loader2 } from 'lucide-react'
import type { Database } from '@/lib/database.types'

type BookmarkType = Database['public']['Tables']['bookmarks']['Row']

interface BookmarkListProps {
  bookmarks: BookmarkType[]
  isLoading: boolean
  connectionStatus: string
  onDelete: (id: string) => Promise<void>
}

export default function BookmarkList({
  bookmarks,
  isLoading,
  connectionStatus,
  onDelete,
}: BookmarkListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this bookmark?')) return

    setDeletingId(id)
    try {
      await onDelete(id)
    } catch (error) {
      console.error('Error deleting bookmark:', error)
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
      <div className="mb-4 flex items-center gap-2 text-sm">
        <div
          className={`w-2 h-2 rounded-full ${
            connectionStatus === 'SUBSCRIBED'
              ? 'bg-green-500 animate-pulse'
              : connectionStatus === 'CHANNEL_ERROR'
              ? 'bg-red-500'
              : 'bg-yellow-500'
          }`}
        />
        <span className="text-gray-600">
          Real-time:{' '}
          {connectionStatus === 'SUBSCRIBED'
            ? 'Connected'
            : connectionStatus === 'CHANNEL_ERROR'
            ? 'Error'
            : connectionStatus === 'TIMED_OUT'
            ? 'Timed Out'
            : 'Connecting...'}
        </span>
      </div>

      {bookmarks.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Bookmark className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No bookmarks yet
          </h3>
          <p className="text-gray-600">
            Add your first bookmark using the form above!
          </p>
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
                className={`bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-all ${
                  deletingId === bookmark.id ? 'opacity-50 scale-95' : ''
                }`}
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
                    {deletingId === bookmark.id ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Trash2 size={18} />
                    )}
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
