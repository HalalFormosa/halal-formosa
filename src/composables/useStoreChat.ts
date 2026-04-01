import { ref, computed } from 'vue'
import { supabase } from '@/plugins/supabaseClient'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface ChatMessage {
  id: string
  conversation_id: string
  sender_id: string
  message: string
  image_url?: string | null
  is_read: boolean
  created_at: string
}

export interface ChatConversation {
  id: string
  buyer_id: string
  store_user_id: string
  store_id: string | null
  product_id: string | null
  last_message: string | null
  last_message_at: string
  buyer_unread: number
  store_unread: number
  created_at: string
  // Joined
  store_products?: { name: string; name_zh: string | null; images: string[] | null } | null
  merchant_stores?: { name: string; logo_url: string | null } | null
}

export function useStoreChat() {
  const messages = ref<ChatMessage[]>([])
  const loading = ref(false)
  const sending = ref(false)
  let channel: RealtimeChannel | null = null

  /**
   * Get or create a conversation between buyer and store owner.
   * If productId is provided, it links the conversation to that product context.
   */
  async function getOrCreateConversation(
    storeUserId: string,
    productId?: string | null
  ): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return null
    const buyerId = session.user.id

    // Try to find existing conversation
    let query = supabase
      .from('store_chat_conversations')
      .select('id')
      .eq('buyer_id', buyerId)
      .eq('store_user_id', storeUserId)

    if (productId) {
      query = query.eq('product_id', productId)
    }

    const { data: existing } = await query.limit(1).single()
    if (existing) return existing.id

    // Get the merchant store ID for this user
    const { data: storeInfo } = await supabase
      .from('merchant_stores')
      .select('id')
      .eq('user_id', storeUserId)
      .single()

    // Create new
    const { data: created, error } = await supabase
      .from('store_chat_conversations')
      .insert({
        buyer_id: buyerId,
        store_user_id: storeUserId,
        store_id: storeInfo?.id || null,
        product_id: productId || null
      })
      .select('id')
      .single()

    if (error) {
      console.error('[Chat] Failed to create conversation:', error)
      return null
    }
    return created?.id || null
  }

  /**
   * Fetch messages for a conversation (most recent 50)
   */
  async function fetchMessages(conversationId: string) {
    loading.value = true
    const { data } = await supabase
      .from('store_chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(100)

    messages.value = data || []
    loading.value = false
  }

  /**
   * Send a message
   */
  async function sendMessage(conversationId: string, text: string, imageUrl?: string) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session || !text.trim()) return { success: false, error: 'No session' }

    sending.value = true
    const { error: insertError } = await supabase
      .from('store_chat_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: session.user.id,
        message: text.trim(),
        image_url: imageUrl || null
      })

    if (insertError) {
      console.error('[Chat] Failed to insert message:', insertError)
      sending.value = false
      return { success: false, error: insertError.message }
    }

    // Update conversation last_message and unread counts
    const { data: conv, error: fetchError } = await supabase
      .from('store_chat_conversations')
      .select('buyer_id, store_user_id, buyer_unread, store_unread')
      .eq('id', conversationId)
      .single()

    if (fetchError) {
      console.error('[Chat] Failed to fetch conversation for update:', fetchError)
      // We don't return false here because the message was actually sent
    } else if (conv) {
      const isBuyer = session.user.id === conv.buyer_id
      const { error: updateError } = await supabase
        .from('store_chat_conversations')
        .update({
          last_message: text.trim().substring(0, 100),
          last_message_at: new Date().toISOString(),
          ...(isBuyer
            ? { store_unread: (conv.store_unread || 0) + 1 }
            : { buyer_unread: (conv.buyer_unread || 0) + 1 }
          )
        })
        .eq('id', conversationId)

      if (updateError) {
        console.error('[Chat] Failed to update conversation info:', updateError)
      }
    }

    sending.value = false
    return { success: true }
  }

  /**
   * Subscribe to new messages in real time
   */
  function subscribeToMessages(conversationId: string) {
    unsubscribe() // clean up previous

    channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'store_chat_messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage
          // Avoid duplicates
          if (!messages.value.find(m => m.id === newMsg.id)) {
            messages.value.push(newMsg)
          }
        }
      )
      .subscribe()
  }

  /**
   * Mark all messages as read for the current user
   */
  async function markAsRead(conversationId: string) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    // Mark messages as read
    await supabase
      .from('store_chat_messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', session.user.id)
      .eq('is_read', false)

    // Reset unread counter
    const { data: conv } = await supabase
      .from('store_chat_conversations')
      .select('buyer_id')
      .eq('id', conversationId)
      .single()

    if (conv) {
      const isBuyer = session.user.id === conv.buyer_id
      await supabase
        .from('store_chat_conversations')
        .update(isBuyer ? { buyer_unread: 0 } : { store_unread: 0 })
        .eq('id', conversationId)
    }
  }

  function unsubscribe() {
    if (channel) {
      supabase.removeChannel(channel)
      channel = null
    }
  }

  return {
    messages,
    loading,
    sending,
    getOrCreateConversation,
    fetchMessages,
    sendMessage,
    subscribeToMessages,
    markAsRead,
    unsubscribe
  }
}
