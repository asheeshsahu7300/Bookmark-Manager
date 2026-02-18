import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// GET — fetch all bookmarks
export async function GET() {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('bookmarks')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('GET bookmarks error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// POST — add a bookmark
export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { title, url } = body

  if (!title || !url) {
    return NextResponse.json({ error: 'title and url are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('bookmarks')
    .insert({ title, url, user_id: session.user.id })
    .select()
    .single()

  if (error) {
    console.error('POST bookmark error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// DELETE — delete a bookmark
export async function DELETE(request: NextRequest) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  console.log(`🗑️ Server deleting bookmark ${id} for user ${session.user.id}`)

  const { error, count } = await supabase
    .from('bookmarks')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('user_id', session.user.id)

  console.log(`🗑️ Server delete result — error: ${error?.message || 'none'}, count: ${count}`)

  if (error) {
    console.error('DELETE bookmark error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (count === 0) {
    return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, deletedId: id })
}
