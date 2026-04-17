import { useState, FormEvent } from 'react';
import { Hash, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../ui/Modal';

interface CreateGroupModalProps {
  onClose: () => void;
  onCreated: (groupId: string) => void;
}

export default function CreateGroupModal({ onClose, onCreated }: CreateGroupModalProps) {
  const { profile } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSecret, setIsSecret] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (isSecret && !password.trim()) { setError('Secret groups require a password'); return; }

    setLoading(true);
    setError('');

    const { data, error: err } = await supabase
      .from('groups')
      .insert({
        name: name.trim(),
        description: description.trim(),
        is_secret: isSecret,
        group_password: isSecret ? password.trim() : null,
        creator_id: profile.id,
      })
      .select()
      .maybeSingle();

    if (err) { setError(err.message); setLoading(false); return; }
    if (!data) { setError('Failed to create group'); setLoading(false); return; }

    await supabase.from('group_members').insert({ group_id: data.id, user_id: profile.id, role: 'creator' });

    onCreated(data.id);
    onClose();
  };

  return (
    <Modal title="Create Group" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Group Name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My awesome group"
            required
            maxLength={50}
            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Description (optional)</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this group about?"
            maxLength={200}
            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setIsSecret(false)}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
              !isSecret ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-slate-700 text-slate-400 hover:border-slate-600'
            }`}
          >
            <Hash size={20} />
            <div className="text-sm font-medium">Public</div>
            <div className="text-xs opacity-70">Anyone can join</div>
          </button>
          <button
            type="button"
            onClick={() => setIsSecret(true)}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
              isSecret ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-slate-700 text-slate-400 hover:border-slate-600'
            }`}
          >
            <Lock size={20} />
            <div className="text-sm font-medium">Secret</div>
            <div className="text-xs opacity-70">Password required</div>
          </button>
        </div>

        {isSecret && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Group Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter group password"
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm"
            />
          </div>
        )}

        {error && (
          <div className="px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-700 text-slate-400 rounded-xl hover:bg-slate-700/30 transition-colors text-sm">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors text-sm">
            {loading ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
