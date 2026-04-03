import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GROUPS } from '../data/mockData';
import { useToast } from '../components/ToastProvider';

function GroupCard({ group, onClick }) {
    const avatarColors = ['#6366f1', '#22c55e', '#3b82f6', '#f59e0b'];
    return (
        <div onClick={onClick} className="bg-bg-card border border-border rounded-[20px] p-6 cursor-pointer hover:-translate-y-[3px] hover:border-[rgba(99,102,241,0.3)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.5)] transition-all relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-20 h-20 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.1),transparent)]" />
            <div className="text-4xl mb-4">{group.emoji}</div>
            <div className="text-base font-bold mb-1.5">{group.name}</div>
            <div className="text-xs text-text-secondary mb-[18px]">{group.desc}</div>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <div className="flex">
                        {Array.from({ length: Math.min(group.members, 4) }, (_, i) => (
                            <div key={i} className="w-[26px] h-[26px] rounded-full border-2 border-bg-card flex items-center justify-center text-[0.7rem] font-bold text-white" style={{ background: avatarColors[i % 4], marginLeft: i > 0 ? -8 : 0 }}>
                                {String.fromCharCode(65 + i)}
                            </div>
                        ))}
                    </div>
                    <span className="text-xs text-text-muted ml-1">{group.members} members</span>
                </div>
                <div className="text-right">
                    <div className={`text-sm font-bold ${group.balance > 0 ? 'text-green' : group.balance < 0 ? 'text-red' : ''}`}>
                        {group.balance > 0 ? '+' : ''}₹{Math.abs(group.balance).toLocaleString()}
                    </div>
                    <div className="text-[0.72rem] text-text-muted">{group.balance > 0 ? 'you receive' : group.balance < 0 ? 'you owe' : 'settled'}</div>
                </div>
            </div>
        </div>
    );
}

function CreateGroupModal({ open, onClose }) {
    const [name, setName] = useState('');
    const [desc, setDesc] = useState('');
    const [emoji, setEmoji] = useState('');
    const [emails, setEmails] = useState('');
    const showToast = useToast();
    const emojis = ['🏖', '🏠', '🎓', '💼', '🎉', '🍕', '⚽', '🚗'];

    if (!open) return null;

    const handleCreate = () => {
        if (!name) { showToast('error', 'Missing', 'Please enter a group name'); return; }
        onClose();
        showToast('success', 'Group Created!', `"${name}" created. Invite links sent.`);
        setName(''); setDesc(''); setEmoji(''); setEmails('');
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
                <div className="mb-5">
                    <label className="block text-sm text-text-secondary font-medium mb-2">Invite Members (by email)</label>
                    <input type="text" value={emails} onChange={e => setEmails(e.target.value)} placeholder="rohan@gmail.com, anita@gmail.com..." className="w-full bg-bg-input border border-border text-text-primary px-4 py-3 rounded-[10px] text-[0.95rem] outline-none focus:border-accent transition placeholder:text-text-muted" />
                </div>
                <div className="flex gap-3 mt-2">
                    <button onClick={onClose} className="flex-1 px-5 py-2.5 rounded-[10px] text-sm font-semibold bg-bg-card text-text-primary border border-border hover:bg-bg-card-hover transition">Cancel</button>
                    <button onClick={handleCreate} className="flex-[2] px-5 py-2.5 rounded-[10px] text-sm font-semibold bg-accent text-white hover:bg-[#5254cc] transition">Create Group →</button>
                </div>
            </div>
        </div>
    );
}

export default function GroupsPage() {
    const [modalOpen, setModalOpen] = useState(false);
    const navigate = useNavigate();

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-7">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">My Groups</h1>
                    <p className="text-text-secondary text-sm mt-1">6 active groups · ₹12,480 total shared expenses</p>
                </div>
                <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-sm font-semibold bg-accent text-white hover:bg-[#5254cc] transition">+ Create Group</button>
            </div>
            <div className="grid grid-cols-3 gap-5">
                {GROUPS.map(g => (
                    <GroupCard key={g.id} group={g} onClick={() => navigate(`/groups/${g.id}`)} />
                ))}
            </div>
            <CreateGroupModal open={modalOpen} onClose={() => setModalOpen(false)} />
        </div>
    );
}
