import { getSupabaseClient } from './client'
import type { DiscussionMessage } from '../../domain'

export const messagesService = {
  async fetchMessagesForEvent(eventId: string): Promise<DiscussionMessage[]> {
    const supabase = getSupabaseClient()
    if (!supabase) return []

    try {
      const { data, error } = await supabase
        .from('event_messages')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true })

      if (error || !data) {
        console.warn('[DO Supabase] Error loading messages:', error)
        return []
      }

      return data.map((row) => ({
        id: row.id,
        userName: row.user_name,
        avatar: row.avatar,
        body: row.body,
        createdAt: row.created_at || new Date().toISOString(),
      }))
    } catch (err) {
      console.warn('[DO Supabase] Exception loading event messages:', err)
      return []
    }
  },

  async postMessage(eventId: string, message: DiscussionMessage): Promise<boolean> {
    const supabase = getSupabaseClient()
    if (!supabase) return false

    try {
      const { error } = await supabase.from('event_messages').upsert(
        {
          id: message.id,
          event_id: eventId,
          user_name: message.userName,
          avatar: message.avatar,
          body: message.body,
          created_at: message.createdAt,
        },
        { onConflict: 'id' },
      )

      if (error) {
        console.warn('[DO Supabase] Error inserting message:', error)
        return false
      }
      return true
    } catch (err) {
      console.warn('[DO Supabase] Exception inserting message:', err)
      return false
    }
  },

  subscribeToMessages(
    eventId: string,
    onMessage: (msg: DiscussionMessage) => void,
  ): () => void {
    const supabase = getSupabaseClient()
    let isSubscribed = true
    let pollTimer: ReturnType<typeof setInterval> | null = null

    // Active polling fallback ensures messages arrive across browsers/tabs
    pollTimer = setInterval(async () => {
      if (!isSubscribed) return
      try {
        const fresh = await messagesService.fetchMessagesForEvent(eventId)
        if (!isSubscribed) return
        for (const msg of fresh) {
          onMessage(msg)
        }
      } catch {
        // network or idle fallback
      }
    }, 3000)

    if (!supabase) {
      return () => {
        isSubscribed = false
        if (pollTimer) clearInterval(pollTimer)
      }
    }

    try {
      const channel = supabase
        .channel(`chat_${eventId}_${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'event_messages',
            filter: `event_id=eq.${eventId}`,
          },
          (payload) => {
            if (!isSubscribed) return
            const row = payload.new as {
              id?: string
              user_name?: string
              avatar?: string
              body?: string
              created_at?: string
            }
            if (row && row.body && row.id && row.user_name) {
              onMessage({
                id: row.id,
                userName: row.user_name,
                avatar: row.avatar || row.user_name.slice(0, 1) || '?',
                body: row.body,
                createdAt: row.created_at || new Date().toISOString(),
              })
            }
          },
        )
        .subscribe()

      return () => {
        isSubscribed = false
        if (pollTimer) clearInterval(pollTimer)
        try {
          supabase.removeChannel(channel).catch(() => {})
        } catch {
          // ignore cleanup errors
        }
      }
    } catch (err) {
      console.warn('[DO Supabase] Realtime subscription exception:', err)
      return () => {
        isSubscribed = false
        if (pollTimer) clearInterval(pollTimer)
      }
    }
  },
}

