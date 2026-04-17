
/*
  # Flux Messenger - Complete Schema

  Creates all tables first, then enables RLS and policies,
  then functions and triggers.

  Tables: app_settings, profiles, conversations, direct_messages,
          groups, group_members, group_messages

  Security: RLS on all tables with appropriate policies
  Functions: handle_new_user trigger, get_or_create_conversation, join_secret_group
*/

-- =====================
-- TABLES
-- =====================

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO app_settings (key, value) VALUES
  ('allow_group_creation', 'true'),
  ('registration_counter', '0')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  registration_order integer,
  is_developer boolean DEFAULT false,
  avatar_color text DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant1_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  participant2_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(participant1_id, participant2_id),
  CHECK (participant1_id < participant2_id)
);

CREATE TABLE IF NOT EXISTS direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) > 0),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) > 0),
  description text DEFAULT '',
  is_secret boolean DEFAULT false,
  group_password text DEFAULT NULL,
  creator_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('creator', 'admin', 'member')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(group_id, user_id)
);

CREATE TABLE IF NOT EXISTS group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) > 0),
  created_at timestamptz DEFAULT now()
);

-- =====================
-- RLS ENABLE
-- =====================
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;

-- =====================
-- APP SETTINGS POLICIES
-- =====================
CREATE POLICY "Anyone authenticated can read settings"
  ON app_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only developer can update settings"
  ON app_settings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_developer = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_developer = true));

-- =====================
-- PROFILES POLICIES
-- =====================
CREATE POLICY "Authenticated users can view all profiles"
  ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- =====================
-- CONVERSATIONS POLICIES
-- =====================
CREATE POLICY "Participants can view their conversations"
  ON conversations FOR SELECT TO authenticated
  USING (auth.uid() = participant1_id OR auth.uid() = participant2_id);

CREATE POLICY "Authenticated users can create conversations"
  ON conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = participant1_id OR auth.uid() = participant2_id);

-- =====================
-- DIRECT MESSAGES POLICIES
-- =====================
CREATE POLICY "Conversation participants can view messages"
  ON direct_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND (c.participant1_id = auth.uid() OR c.participant2_id = auth.uid())
    )
  );

CREATE POLICY "Conversation participants can send messages"
  ON direct_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND (c.participant1_id = auth.uid() OR c.participant2_id = auth.uid())
    )
  );

-- =====================
-- GROUPS POLICIES
-- =====================
CREATE POLICY "Members can view their groups, non-secret visible to all"
  ON groups FOR SELECT TO authenticated
  USING (
    NOT is_secret OR
    EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = id AND gm.user_id = auth.uid())
  );

CREATE POLICY "Authenticated users can create groups (if allowed)"
  ON groups FOR INSERT TO authenticated
  WITH CHECK (
    creator_id = auth.uid() AND (
      (SELECT value FROM app_settings WHERE key = 'allow_group_creation') = 'true' OR
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_developer = true)
    )
  );

CREATE POLICY "Creator can update group"
  ON groups FOR UPDATE TO authenticated
  USING (creator_id = auth.uid()) WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Creator or developer can delete group"
  ON groups FOR DELETE TO authenticated
  USING (
    creator_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_developer = true)
  );

-- =====================
-- GROUP MEMBERS POLICIES
-- =====================
CREATE POLICY "Members can view group members"
  ON group_members FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM group_members gm2 WHERE gm2.group_id = group_id AND gm2.user_id = auth.uid())
  );

CREATE POLICY "Users can insert themselves or admins can add members"
  ON group_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_id AND gm.user_id = auth.uid() AND gm.role IN ('creator', 'admin')
    )
  );

CREATE POLICY "Users leave or admins remove members"
  ON group_members FOR DELETE TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_id AND gm.user_id = auth.uid() AND gm.role IN ('creator', 'admin')
    ) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_developer = true)
  );

CREATE POLICY "Admins can update member roles"
  ON group_members FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_id AND gm.user_id = auth.uid() AND gm.role IN ('creator', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_id AND gm.user_id = auth.uid() AND gm.role IN ('creator', 'admin')
    )
  );

-- =====================
-- GROUP MESSAGES POLICIES
-- =====================
CREATE POLICY "Group members can view messages"
  ON group_messages FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = group_id AND gm.user_id = auth.uid())
  );

CREATE POLICY "Group members can send messages"
  ON group_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = group_id AND gm.user_id = auth.uid())
  );

CREATE POLICY "Sender or admin can delete message"
  ON group_messages FOR DELETE TO authenticated
  USING (
    sender_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_id AND gm.user_id = auth.uid() AND gm.role IN ('creator', 'admin')
    )
  );

-- =====================
-- FUNCTIONS & TRIGGERS
-- =====================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  counter integer;
  username_val text;
  colors text[] := ARRAY['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4','#F97316'];
  chosen_color text;
BEGIN
  UPDATE app_settings
    SET value = (value::integer + 1)::text, updated_at = now()
    WHERE key = 'registration_counter'
    RETURNING value::integer INTO counter;

  username_val := NEW.raw_user_meta_data->>'username';
  chosen_color := colors[1 + ((counter - 1) % array_length(colors, 1))];

  INSERT INTO profiles (id, username, registration_order, is_developer, avatar_color)
  VALUES (NEW.id, username_val, counter, counter = 1, chosen_color);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE OR REPLACE FUNCTION get_or_create_conversation(other_user_id uuid)
RETURNS uuid AS $$
DECLARE
  conv_id uuid;
  p1 uuid;
  p2 uuid;
BEGIN
  IF auth.uid() < other_user_id THEN
    p1 := auth.uid(); p2 := other_user_id;
  ELSE
    p1 := other_user_id; p2 := auth.uid();
  END IF;

  SELECT id INTO conv_id FROM conversations
  WHERE participant1_id = p1 AND participant2_id = p2;

  IF conv_id IS NULL THEN
    INSERT INTO conversations (participant1_id, participant2_id)
    VALUES (p1, p2)
    RETURNING id INTO conv_id;
  END IF;

  RETURN conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION join_secret_group(p_group_id uuid, p_password text)
RETURNS boolean AS $$
DECLARE
  stored_password text;
  already_member boolean;
BEGIN
  SELECT group_password INTO stored_password FROM groups WHERE id = p_group_id;

  SELECT EXISTS(
    SELECT 1 FROM group_members WHERE group_id = p_group_id AND user_id = auth.uid()
  ) INTO already_member;

  IF already_member THEN RETURN true; END IF;

  IF stored_password IS NOT NULL AND stored_password = p_password THEN
    INSERT INTO group_members (group_id, user_id, role) VALUES (p_group_id, auth.uid(), 'member');
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================
-- INDEXES
-- =====================
CREATE INDEX IF NOT EXISTS idx_direct_messages_conv ON direct_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages(group_id, created_at);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_conversations_p1 ON conversations(participant1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_p2 ON conversations(participant2_id);
