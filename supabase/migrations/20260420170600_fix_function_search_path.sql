
/*
  # Fix Function Search Path Security

  Sets immutable search_path on all SECURITY DEFINER functions to prevent
  search_path attacks where a malicious user could hijack functions by creating
  objects in a lower schema.

  All three functions now have:
  - search_path = pg_catalog, public (immutable)
  - This ensures predictable behavior and prevents search_path manipulation
*/

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;
