import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useToast } from '../components/ToastProvider';

function GroupCard({ group, onClick }) {
    const avatarColors = ['#6366f1', '#22c55e', '#3b82f6', '#f59e0b'];
    const membersCount = group.members_count || 1; 
    const balance = group.user_balance || 0;

    return (
        <div onClick={onClick} className="bg-bg-card border border-border rounded-[20px] p-6 cursor-pointer hover:-translate-y-[3px] hover:border-[rgba(99,102,241,0.3)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.5)] transition-all relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-20 h-20 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.1),transparent)]" />
            <div className="text-4xl mb-4">{group.emoji || '👥'}</div>
            <div className="text-base font-bold mb-1.5">{group.name}</div>
            <div className="text-xs text-text-secondary mb-[18px] truncate">{group.description || 'No description'}</div>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <div className="flex">
                        {Array.from({ length: Math.min(membersCount, 4) }, (_, i) => (
                            <div key={i} className="w-[26px] h-[26px] rounded-full border-2 border-bg-card flex items-center justify-center text-[0.7rem] font-bold text-white" style={{ background: avatarColors[i % 4], marginLeft: i > 0 ? -8 : 0 }}>
                                {String.fromCharCode(65 + i)}
                            </div>
                        ))}
                    </div>
                    <span className="text-xs text-text-muted ml-1">{membersCount} members</span>
                </div>
                <div className="text-right">
                    <div className={`text-sm font-bold ${balance > 0 ? 'text-green' : balance < 0 ? 'text-red' : ''}`}>
                        {balance > 0 ? '+' : ''}₹{Math.abs(balance).toLocaleString()}
                    </div>
                    <div className="text-[0.72rem] text-text-muted">{balance > 0 ? 'you receive' : balance < 0 ? 'you owe' : 'settled'}</div>
                </div>
            </div>
        </div>
    );
}

function CreateGroupModal({ open, onClose, onCreated }) {
    const [name, setName] = useState('');
    const [desc, setDesc] = useState('');
    const [emoji, setEmoji] = useState('👥');
    const [loading, setLoading] = useState(false);
    const showToast = useToast();
    const emojis = ['🏖', '🏠', '🎓', '💼', '🎉', '🍕', '⚽', '🚗', '👥'];

    if (!open) return null;

    const handleCreate = async () => {
        if (!name) { showToast('error', 'Missing', 'Please enter a group name'); return; }
        setLoading(true);
        try {
            const res = await api.post('/api/groups', {
                name,
                description: desc,
                emoji
            });
            showToast('success', 'Group Created!', `"${name}" created. Invite code: ${res.data.invite_code}`);
            onCreated(res.data);
            onClose();
            setName(''); setDesc(''); setEmoji('👥');
        } catch(e) {
            showToast('error', 'Failed', 'Could not create group.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div onClick={e => e.target === e.currentTarget && onClose()} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[1000] flex items-center justify-center p-6 animate-fade-in">
            <div className="bg-bg-card border border-border rounded-[20px] p-8 w-full max-w-[520px] max-h-[90vh] overflow-y-auto animate-[scaleIn_0.25s_cubic-bezier(0.4,0,0.2,1)]">
                <div className="flex items-center justify-between mb-6">
                    <div className="text-lg font-bold">Create New Group</div>
                    <button onClick={onClose} className="bg-transparent border-none text-text-muted text-xl cursor-pointer hover:text-text-primary transition">×</button>
                </div>
                <div className="mb-5">
                    <label className="block text-sm text-text-secondary font-medium mb-2">Group Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Goa Trip 2026" className="w-full bg-bg-input border border-border text-text-primary px-4 py-3 rounded-[10px] text-[0.95rem] outline-none focus:border-accent transition placeholder:text-text-muted" />
                </div>
                <div className="mb-5">
                    <label className="block text-sm text-text-secondary font-medium mb-2">Description</label>
                    <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="What's this group for?" className="w-full bg-bg-input border border-border text-text-primary px-4 py-3 rounded-[10px] text-[0.95rem] outline-none focus:border-accent transition placeholder:text-text-muted" />
                </div>
                <div className="mb-5">
                    <label className="block text-sm text-text-secondary font-medium mb-2">Pick an Emoji</label>
                    <div className="flex gap-2 flex-wrap mt-2">
                        {emojis.map(e => (
                            <span key={e} onClick={() => setEmoji(e)} className={`text-2xl cursor-pointer p-1 px-2 rounded-md transition ${emoji === e ? 'bg-accent-dim ring-1 ring-accent' : 'hover:bg-white/10'}`}>{e}</span>
                        ))}
                    </div>
                </div>
                <div className="flex gap-3 mt-7">
                    <button onClick={onClose} className="flex-1 px-5 py-2.5 rounded-[10px] text-sm font-semibold bg-bg-card text-text-primary border border-border hover:bg-bg-card-hover transition">Cancel</button>
                    <button disabled={loading} onClick={handleCreate} className="flex-[2] px-5 py-2.5 rounded-[10px] text-sm font-semibold bg-accent text-white hover:bg-[#5254cc] transition disabled:opacity-50">
                        {loading ? 'Creating...' : 'Create Group →'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function JoinGroupModal({ open, onClose }) {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const showToast = useToast();

    if (!open) return null;

    const handleJoin = async () => {
        if (!code.trim()) { showToast('error', 'Missing', 'Please enter an invite code'); return; }
        setLoading(true);
        try {
            const res = await api.post('/api/groups/join', { invite_code: code.trim() });
            showToast('success', 'Request Sent! 🎉', `Your request to join "${res.data.group_name || 'the group'}" has been sent.`);
            onClose();
            setCode('');
        } catch (e) {
            const msg = e.response?.data?.detail || 'Could not submit join request.';
            showToast('error', 'Failed', msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div onClick={e => e.target === e.currentTarget && onClose()} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[1000] flex items-center justify-center p-6 animate-fade-in">
            <div className="bg-bg-card border border-border rounded-[20px] p-8 w-full max-w-[440px] animate-[scaleIn_0.25s_cubic-bezier(0.4,0,0.2,1)]">
                <div className="flex items-center justify-between mb-6">
                    <div className="text-lg font-bold">Join a Group</div>
                    <button onClick={onClose} className="bg-transparent border-none text-text-muted text-xl cursor-pointer hover:text-text-primary transition">×</button>
                </div>
                <div className="mb-2">
                    <label className="block text-sm text-text-secondary font-medium mb-2">Invite Code</label>
                    <input
                        type="text"
                        value={code}
                        onChange={e => setCode(e.target.value.toUpperCase())}
                        placeholder="e.g., AB3K9XZ2"
                        maxLength={8}
                        className="w-full bg-bg-input border border-border text-text-primary px-4 py-3 rounded-[10px] text-[1.1rem] font-mono tracking-[0.3em] text-center outline-none focus:border-accent transition placeholder:text-text-muted placeholder:tracking-[0.15em] placeholder:text-sm placeholder:font-sans"
                    />
                </div>
                <p className="text-xs text-text-muted mb-6">Ask the group admin to share their 8-character invite code.</p>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 px-5 py-2.5 rounded-[10px] text-sm font-semibold bg-bg-card text-text-primary border border-border hover:bg-bg-card-hover transition">Cancel</button>
                    <button disabled={loading} onClick={handleJoin} className="flex-[2] px-5 py-2.5 rounded-[10px] text-sm font-semibold bg-accent text-white hover:bg-[#5254cc] transition disabled:opacity-50">
                        {loading ? 'Submitting...' : 'Send Request →'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function GroupsPage() {
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [joinModalOpen, setJoinModalOpen] = useState(false);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        api.get('/api/groups')
            .then(res => setGroups(res.data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    const handleCreated = (newGroup) => {
        setGroups([newGroup, ...groups]);
    }

    if (loading) return <div className="p-8 text-text-muted">Loading groups...</div>;

    const activeGroups = groups.filter(g => g.is_active !== false);
    const historyGroups = groups.filter(g => g.is_active === false);

    return (
        <div className="animate-fade-in pb-12">
            <div className="flex items-center justify-between mb-7">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">My Groups</h1>
                    <p className="text-text-secondary text-sm mt-1">{activeGroups.length} active groups</p>
                </div>
                <div className="flex gap-2.5">
                    <button onClick={() => setJoinModalOpen(true)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-sm font-semibold bg-bg-card text-text-primary border border-border hover:bg-bg-card-hover transition">🔗 Join Group</button>
                    <button onClick={() => setCreateModalOpen(true)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-sm font-semibold bg-accent text-white hover:bg-[#5254cc] transition">+ Create Group</button>
                </div>
            </div>

            {activeGroups.length === 0 && <div className="text-text-muted mb-8 p-12 bg-bg-card border border-border border-dashed rounded-[20px] text-center">You have no active groups yet. Create one!</div>}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
                {activeGroups.map(g => (
                    <GroupCard key={g.id} group={g} onClick={() => navigate(`/groups/${g.id}`)} />
                ))}
            </div>

            {historyGroups.length > 0 && (
                <div className="mt-12">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="h-px flex-1 bg-border" />
                        <h2 className="text-sm font-bold uppercase tracking-widest text-text-muted flex items-center gap-2">
                            <span>📜</span> History / Inactive Groups
                        </h2>
                        <div className="h-px flex-1 bg-border" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 opacity-70 grayscale-[0.5]">
                        {historyGroups.map(g => (
                            <GroupCard key={g.id} group={g} onClick={() => navigate(`/groups/${g.id}`)} />
                        ))}
                    </div>
                </div>
            )}

            <CreateGroupModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} onCreated={handleCreated} />
            <JoinGroupModal open={joinModalOpen} onClose={() => setJoinModalOpen(false)} />
        </div>
    );
}
