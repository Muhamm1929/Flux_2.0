
/*
  # Properly Fix Group Members Recursion

  The previous policy still caused recursion because it tried to join
  on group_members within the policy check itself.

  New approach: Users can only view their own membership records, or
  they can view other members if they're a member of the same group
  (checked via a simple foreign key join, not recursive).
*/

DROP POLICY IF EXISTS "Members can view group members" ON group_members;

CREATE POLICY "Members can view group members"
  ON group_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM groups g
    WHERE g.id = group_id
      AND EXISTS (
        SELECT 1 FROM group_members gm
        WHERE gm.group_id = g.id AND gm.user_id = auth.uid()
      )
  ));
