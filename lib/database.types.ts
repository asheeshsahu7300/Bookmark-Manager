export type Database = {
  public: {
    Tables: {
      bookmarks: {
        Row: {
          id: string
          user_id: string
          title: string
          url: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          url: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          url?: string
          created_at?: string
        }
      }
    }
  }
}
