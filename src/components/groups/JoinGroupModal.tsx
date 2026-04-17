import { useState, useEffect, useCallback } from 'react';
import { Hash, Lock, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Group } from '../../types';
import Modal from '../ui/Modal';

interface JoinGroupModalProps {
  onClose: () => void;
  onJoined: (group: Group) => void;
}

export default function JoinGroupModal({ onClose, onJoined }: JoinGroupModalProps) {
  const { profile } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selected, setSelected] = useState<Group | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [joinedIds, setJoinedIds] = useState<string[]>([]);

  const loadGroups = useCallback(async () => {
    const { data } = await supabase.from('groups').select('*').eq('is_secret', false).order('name');
    setGroups(data ?? []);
    if (profile) {
      const { data: mems } = await supabase.from('group_members').select('group_id').eq('user_id', profile.id);
      setJoinedIds(mems?.map((m) => m.group_id) ?? []);
    }
  }, [profile]);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  const joinPublicGroup = async (group: Group) => {
    if (!profile) return;
    setLoading(true);
    const { error: err } = await supabase.from('group_members').insert({ group_id: group.id, user_id: profile.id, role: 'member' });
    if (err) { setError(err.message); setLoading(false); return; }
    setJoinedIds((prev) => [...prev, group.id]);
    onJoined(group);
    onClose();
    setLoading(false);
  };

  const joinSecretGroup = async () => {
    if (!selected || !password.trim()) return;
    setLoading(true);
    setError('');
    const { data } = await supabase.rpc('join_secret_group', { p_group_id: selected.id, p_password: password.trim() });
    if (!data) { setError('Incorrect password'); setLoading(false); return; }
    onJoined(selected);
    onClose();
    setLoading(false);
  };

  if (selected) {
    return (
      <Modal title={`Join "${selected.name}"`} onClose={() => { setSelected(null); setPassword(''); setError(''); }}>
        <div className="space-y-4">
          <p className="text-slate-400 text-sm">Enter the group password to join this secret group.</p>
          <input
            autoFocus
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Group password"
            onKeyDown={(e) => { if (e.key === 'Enter') joinSecretGroup(); }}
            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm"
          />
          {error && <div className="px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
          <div className="flex gap-3">
            <button onClick={() => { setSelected(null); setPassword(''); setError(''); }} className="flex-1 py-2.5 border border-slate-700 text-slate-400 rounded-xl hover:bg-slate-700/30 transition-colors text-sm">
              Back
            </button>
            <button onClick={joinSecretGroup} disabled={loading || !password.trim()} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors text-sm">
              {loading ? 'Joining...' : 'Join Group'}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Browse Groups" onClose={onClose} maxWidth="max-w-lg">
      <div className="space-y-3">
        <p className="text-slate-400 text-sm">Join a public group or enter a password for a secret group.</p>

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {groups.length === 0 && (
            <p className="text-center text-slate-600 py-8 text-sm">No public groups available</p>
          )}
          {groups.map((group) => {
            const isJoined = joinedIds.includes(group.id);
            return (
              <div
                key={group.id}
                className="flex items-center gap-3 p-3 bg-slate-900 rounded-xl border border-slate-700/50"
              >
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Hash size={18} className="text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-slate-100 font-medium text-sm">{group.name}</div>
                  {group.description && <div className="text-slate-500 text-xs truncate">{group.description}</div>}
                </div>
                {isJoined ? (
                  <span className="text-xs text-slate-500 px-3 py-1.5 bg-slate-700/50 rounded-lg">Joined</span>
                ) : (
                  <button
                    onClick={() => joinPublicGroup(group)}
                    disabled={loading}
                    className="text-xs font-medium px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    Join
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-slate-700/50 pt-3">
          <p className="text-xs text-slate-500 mb-2 flex items-center gap-1.5">
            <Lock size={12} className="text-amber-400" />
            Have a secret group password?
          </p>
          <div className="flex gap-2">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Secret group ID..."
              className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 text-xs"
            />
          </div>
          <p className="text-xs text-slate-600 mt-1.5">Ask the group creator for their group ID and password.</p>
        </div>
      </div>
    </Modal>
  );
}
