export interface Profile {
  id: string;
  username: string;
  registration_order: number;
  is_developer: boolean;
  avatar_color: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  participant1_id: string;
  participant2_id: string;
  created_at: string;
  other_user?: Profile;
  last_message?: DirectMessage;
}

export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: Profile;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  is_secret: boolean;
  group_password?: string;
  creator_id: string;
  created_at: string;
  member_count?: number;
  my_role?: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'creator' | 'admin' | 'member';
  joined_at: string;
  profile?: Profile;
}

export interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: Profile;
}

export type ChatView =
  | { type: 'empty' }
  | { type: 'dm'; conversationId: string; otherUser: Profile }
  | { type: 'group'; groupId: string; group: Group };

export type StatusLabel = 'Developer' | 'Pioneer' | 'Explorer' | 'Trailblazer' | 'Member';

export function getStatusLabel(profile: Profile): StatusLabel {
  if (profile.is_developer) return 'Developer';
  if (profile.registration_order === 1) return 'Pioneer';
  if (profile.registration_order === 2) return 'Explorer';
  if (profile.registration_order === 3) return 'Trailblazer';
  return 'Member';
}
