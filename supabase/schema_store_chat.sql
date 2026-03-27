-- ==========================================
-- Store Chat System — Schema
-- ==========================================

-- 1. Conversations (1 per buyer↔store pair)
CREATE TABLE IF NOT EXISTS store_chat_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL REFERENCES auth.users(id),
  store_user_id UUID NOT NULL REFERENCES auth.users(id),
  product_id UUID REFERENCES store_products(id),
  last_message TEXT,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  buyer_unread INT DEFAULT 0,
  store_unread INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Messages
CREATE TABLE IF NOT EXISTS store_chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES store_chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  message TEXT NOT NULL,
  image_url TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_chat_conv_buyer ON store_chat_conversations(buyer_id);
CREATE INDEX IF NOT EXISTS idx_chat_conv_store ON store_chat_conversations(store_user_id);
CREATE INDEX IF NOT EXISTS idx_chat_msg_conv ON store_chat_messages(conversation_id, created_at);

-- 4. RLS
ALTER TABLE store_chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_chat_messages ENABLE ROW LEVEL SECURITY;

-- Conversations
CREATE POLICY "Users see own conversations" ON store_chat_conversations
  FOR SELECT USING (auth.uid() IN (buyer_id, store_user_id));

CREATE POLICY "Users create conversations" ON store_chat_conversations
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Participants update conversations" ON store_chat_conversations
  FOR UPDATE USING (auth.uid() IN (buyer_id, store_user_id));

CREATE POLICY "Admins manage all conversations" ON store_chat_conversations
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin'));

-- Messages
CREATE POLICY "Participants read messages" ON store_chat_messages
  FOR SELECT USING (
    conversation_id IN (SELECT id FROM store_chat_conversations WHERE auth.uid() IN (buyer_id, store_user_id))
  );

CREATE POLICY "Participants send messages" ON store_chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    conversation_id IN (SELECT id FROM store_chat_conversations WHERE auth.uid() IN (buyer_id, store_user_id))
  );

CREATE POLICY "Participants update messages" ON store_chat_messages
  FOR UPDATE USING (
    conversation_id IN (SELECT id FROM store_chat_conversations WHERE auth.uid() IN (buyer_id, store_user_id))
  );

CREATE POLICY "Admins manage all messages" ON store_chat_messages
  FOR ALL USING (auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin'));

-- 5. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE store_chat_messages;
