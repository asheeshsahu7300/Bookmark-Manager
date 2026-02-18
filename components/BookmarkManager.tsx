'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createBrowserClient } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import type { RealtimeChannel } from '@supabase/supabase-js'
import BookmarkForm from './BookmarkForm'
import BookmarkList from './BookmarkList'

type BookmarkType = Database['public']['Tables']['bookmarks']['Row']

interface BookmarkManagerProps {
  userId: string
}

// ── BroadcastChannel message types ──────────────────────────────
type BroadcastMsg =
  | { type: 'INSERT'; bookmark: BookmarkType }
  | { type: 'DELETE'; id: string }
  | { type: 'REFETCH' }

const BROADCAST_CHANNEL_NAME = 'bookmarks-sync'
let mountCounter = 0

export default function BookmarkManager({ userId }: BookmarkManagerProps) {
  const [bookmarks, setBookmarks] = useState<BookmarkType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected')
  const supabaseRef = useRef(createBrowserClient())
  const broadcastRef = useRef<BroadcastChannel | null>(null)

  const supabase = supabaseRef.current

  // ── Fetch via API route (server-side session) ─────────────────
  const fetchBookmarks = useCallback(async (): Promise<BookmarkType[] | null> => {
    try {
      const res = await fetch('/api/bookmarks')
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to fetch')
      }
      return await res.json()
    } catch (error) {
      console.error('Error fetching bookmarks:', error)
      return null
    }
  }, [])

  // ── Initial fetch ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    fetchBookmarks().then((data) => {
      if (!cancelled && data) {
        setBookmarks(data)
        setIsLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [fetchBookmarks])

  // ── Layer 1: BroadcastChannel — instant same-browser tab sync ─
  useEffect(() => {
    let bc: BroadcastChannel | null = null
    try {
      bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME)
      broadcastRef.current = bc

      bc.onmessage = (event: MessageEvent<BroadcastMsg>) => {
        const msg = event.data
        console.log('📢 BroadcastChannel:', msg.type)

        switch (msg.type) {
          case 'INSERT':
            setBookmarks((prev) => {
              if (prev.some((b) => b.id === msg.bookmark.id)) return prev
              return [msg.bookmark, ...prev]
            })
            break
          case 'DELETE':
            setBookmarks((prev) => prev.filter((b) => b.id !== msg.id))
            break
          case 'REFETCH':
            fetchBookmarks().then((data) => {
              if (data) setBookmarks(data)
            })
            break
        }
      }
    } catch {
      console.warn('BroadcastChannel not available')
    }

    return () => {
      bc?.close()
      broadcastRef.current = null
    }
  }, [fetchBookmarks])

  const broadcast = useCallback((msg: BroadcastMsg) => {
    try { broadcastRef.current?.postMessage(msg) } catch {}
  }, [])

  // ── Layer 2: Supabase Realtime — cross-device sync ────────────
  useEffect(() => {
    let cancelled = false
    const mountId = ++mountCounter
    const channelName = `bookmarks-rt-${userId}-${mountId}`

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'bookmarks', filter: `user_id=eq.${userId}` },
        (payload: any) => {
          if (cancelled) return
          setBookmarks((prev) => {
            if (prev.some((b) => b.id === payload.new.id)) return prev
            return [payload.new as BookmarkType, ...prev]
          })
        }
      )
      .on(
        'postgres_changes' as any,
        { event: 'DELETE', schema: 'public', table: 'bookmarks', filter: `user_id=eq.${userId}` },
        (payload: any) => {
          if (cancelled) return
          setBookmarks((prev) => prev.filter((b) => b.id !== payload.old.id))
        }
      )
      .subscribe((status: string) => {
        if (cancelled) return
        setConnectionStatus(status)
      })

    return () => {
      cancelled = true
      const ch = channel
      setTimeout(() => supabase.removeChannel(ch), 100)
    }
  }, [userId, supabase])

  // ── Layer 3: Visibility refetch — safety net ──────────────────
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchBookmarks().then((data) => {
          if (data) setBookmarks(data)
        })
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [fetchBookmarks])

  // ── ADD via API route ─────────────────────────────────────────
  const handleAddBookmark = useCallback(
    async (title: string, url: string) => {
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, url }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to add bookmark')
      }

      const data: BookmarkType = await res.json()

      setBookmarks((prev) => {
        if (prev.some((b) => b.id === data.id)) return prev
        return [data, ...prev]
      })

      broadcast({ type: 'INSERT', bookmark: data })
    },
    [broadcast]
  )

  // ── DELETE via API route ──────────────────────────────────────
  const handleDeleteBookmark = useCallback(
    async (id: string) => {
      console.log('🗑️ Deleting bookmark via API:', id)

      const res = await fetch(`/api/bookmarks?id=${id}`, {
        method: 'DELETE',
      })

      const result = await res.json()
      console.log('🗑️ API delete response:', res.status, result)

      if (!res.ok) {
        throw new Error(result.error || 'Failed to delete bookmark')
      }

      // API confirmed delete — remove from state
      setBookmarks((prev) => prev.filter((b) => b.id !== id))
      broadcast({ type: 'DELETE', id })
    },
    [broadcast]
  )

  return (
    <>
      <BookmarkForm onAddBookmark={handleAddBookmark} />
      <BookmarkList
        bookmarks={bookmarks}
        isLoading={isLoading}
        connectionStatus={connectionStatus}
        onDelete={handleDeleteBookmark}
      />
    </>
  )
}
