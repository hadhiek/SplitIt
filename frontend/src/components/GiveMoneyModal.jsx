import { useState } from 'react';
import api from '../api';
import { useToast } from './ToastProvider';

export default function GiveMoneyModal({ open, onClose, group, onSuccess }) {
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);
    const showToast = useToast();

    if (!open || !group) return null;

    // Find the admin of this group
    const admin = group.members?.find(m => m.role === 'admin');
    const adminName = admin?.user?.full_name || 'Group Admin';

    const handleSubmit = async () => {
        const amt = parseFloat(amount);
        if (!amt || amt <= 0) {
            showToast('error', 'Invalid Amount', 'Please enter a valid amount greater than 0.');
            return;
        }

        setLoading(true);
        try {
            await api.post('/api/loans', {
                group_id: group.id,
                amount: amt,
                note: note.trim() || null
            });
            showToast('success', 'Money Given! 💰', `₹${amt} given to ${adminName}. This is now reflected in balances.`);
            onSuccess();
            onClose();
            setAmount('');
            setNote('');
        } catch (e) {
            showToast('error', 'Failed', e.response?.data?.detail || 'Could not record the loan.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div onClick={e => e.target === e.currentTarget && onClose()} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[1000] flex items-center justify-center p-6 animate-fade-in">
            <div className="bg-bg-card border border-border rounded-[24px] p-8 w-full max-w-[480px] animate-[scaleIn_0.25s_cubic-bezier(0.4,0,0.2,1)] shadow-2xl">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <div className="text-xl font-bold tracking-tight">💰 Give Money</div>
                        <p className="text-xs text-text-muted mt-1 uppercase tracking-widest font-semibold">{group.name}</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/10 transition">×</button>
                </div>

                {/* Recipient (auto-selected admin) */}
                <div className="mb-6">
                    <label className="block text-[0.7rem] font-bold uppercase tracking-widest text-text-muted mb-3 px-1">Recipient</label>
                    <div className="flex items-center gap-3.5 p-4 rounded-[16px] bg-accent-dim border border-accent/30">
                        <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-white text-sm font-bold">
                            {adminName.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1">
                            <div className="text-sm font-bold text-text-primary">{adminName}</div>
                            <div className="text-xs text-accent-light mt-0.5">Group Admin (Organizer)</div>
                        </div>
                        <div className="text-accent text-xs font-bold px-2 py-1 bg-accent/10 rounded-lg">Auto</div>
                    </div>
                </div>

                {/* Amount */}
                <div className="mb-6">
                    <label className="block text-[0.7rem] font-bold uppercase tracking-widest text-text-muted mb-2 px-1">Amount</label>
                    <div className="relative group">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-bold text-lg group-focus-within:text-accent transition">₹</span>
                        <input
                            type="number"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            placeholder="0.00"
                            min="1"
                            className="w-full bg-bg-input border border-border text-text-primary pl-9 pr-4 py-4 rounded-[16px] text-xl font-bold outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition"
                        />
                    </div>
                </div>

                {/* Note (optional) */}
                <div className="mb-6">
                    <label className="block text-[0.7rem] font-bold uppercase tracking-widest text-text-muted mb-2 px-1">Note <span className="opacity-50">(optional)</span></label>
                    <input
                        type="text"
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        placeholder="e.g., Cash for hotel booking"
                        className="w-full bg-bg-input border border-border text-text-primary px-4 py-3 rounded-[14px] text-sm outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition placeholder:text-text-muted"
                    />
                </div>

                {/* Info */}
                <div className="bg-white/[0.03] border border-border rounded-[14px] p-4 mb-8">
                    <div className="text-xs text-text-muted leading-relaxed">
                        <span className="text-accent font-bold">How it works:</span> This records that you gave money to the admin. Your balance goes <span className="text-green font-bold">up</span> (you are owed), and the admin's balance goes <span className="text-red font-bold">down</span> (they owe). This integrates with settlement optimization.
                    </div>
                </div>

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 px-5 py-3.5 rounded-[16px] text-sm font-bold bg-bg-card text-text-primary border border-border hover:bg-bg-card-hover transition">Cancel</button>
                    <button
                        disabled={loading || !amount || parseFloat(amount) <= 0}
                        onClick={handleSubmit}
                        className="flex-[2] px-5 py-3.5 rounded-[16px] text-sm font-bold bg-accent text-white hover:bg-[#5254cc] shadow-xl shadow-accent/30 transition disabled:opacity-50 disabled:shadow-none"
                    >
                        {loading ? 'Recording...' : `Give ₹${amount || '0'} →`}
                    </button>
                </div>
            </div>
        </div>
    );
}
