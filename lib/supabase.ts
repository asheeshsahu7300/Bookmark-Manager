import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from './database.types'

// Singleton browser client — all components share ONE realtime connection
let browserClient: ReturnType<typeof createClientComponentClient<Database>> | null = null

export const createBrowserClient = () => {
  if (!browserClient) {
    browserClient = createClientComponentClient<Database>()
  }
  return browserClient
}
