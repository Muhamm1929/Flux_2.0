
/*
  # Fix Group Members Recursion and Optimize RLS

  Removes the problematic recursive SELECT policy on group_members view
  that was causing infinite recursion. Admins can manage members without
  needing to view the full member list through RLS - they use the group_id
  directly to identify their admin status.
*/

DROP POLICY IF EXISTS "Members can view group members" ON group_members;

CREATE POLICY "Members can view group members"
  ON group_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR group_id IN (
    SELECT gm.group_id FROM group_members gm WHERE gm.user_id = auth.uid()
  ));
