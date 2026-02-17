import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')

  // If there's an error from the OAuth provider
  if (error) {
    console.error('OAuth error:', error, error_description)
    // Redirect to login page with error
    return NextResponse.redirect(`${requestUrl.origin}/login?error=${error}`)
  }

  if (code) {
    try {
      const cookieStore = cookies()
      const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      
      if (exchangeError) {
        console.error('Code exchange error:', exchangeError)
        return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_failed`)
      }
    } catch (err) {
      console.error('Unexpected error during auth:', err)
      return NextResponse.redirect(`${requestUrl.origin}/login?error=unexpected`)
    }
  }

  // Redirect to home page after successful authentication
  return NextResponse.redirect(requestUrl.origin)
}
