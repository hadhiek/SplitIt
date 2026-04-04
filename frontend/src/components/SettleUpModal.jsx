import { useState } from 'react';
import api from '../api';
import { useToast } from './ToastProvider';
import { Avatar } from './ui';

export default function SettleUpModal({ open, onClose, group, suggestedSettlements, onSettled }) {
    const [selectedSettlement, setSelectedSettlement] = useState(null);
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('cash');
    const [loading, setLoading] = useState(false);
    const showToast = useToast();

    if (!open || !group) return null;

    // Filter suggested settlements where the current user is the "payer" (from_user)
    // Or just let them pick from all suggestions? 
    // Usually, "Settle Up" is about paying what YOU owe.
    
    const handleSettle = async () => {
        if (!selectedSettlement || !amount || parseFloat(amount) <= 0) {
            showToast('error', 'Incomplete', 'Please select a recipient and enter a valid amount.');
            return;
        }

        setLoading(true);
        try {
            await api.post('/api/settlements', {
                group_id: group.id,
                to_user: selectedSettlement.to_user,
                amount: parseFloat(amount),
                payment_method: method
            });
            showToast('success', 'Settled!', `Payment of ₹${amount} recorded.`);
            onSettled();
            onClose();
            setSelectedSettlement(null);
            setAmount('');
        } catch (e) {
            showToast('error', 'Error', e.response?.data?.detail || 'Failed to record settlement.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div onClick={e => e.target === e.currentTarget && onClose()} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[1000] flex items-center justify-center p-6 animate-fade-in">
            <div className="bg-bg-card border border-border rounded-[24px] p-8 w-full max-w-[500px] animate-[scaleIn_0.25s_cubic-bezier(0.4,0,0.2,1)] shadow-2xl">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <div className="text-xl font-bold tracking-tight">Settle Up</div>
                        <p className="text-xs text-text-muted mt-1 uppercase tracking-widest font-semibold">{group.name}</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/10 transition">×</button>
                </div>

                {suggestedSettlements.length > 0 ? (
                    <div className="mb-8">
                        <label className="block text-[0.7rem] font-bold uppercase tracking-widest text-text-muted mb-4 px-1">Suggested Payments</label>
                        <div className="flex flex-col gap-2">
                            {suggestedSettlements.map((s, idx) => (
                                <div 
                                    key={idx}
                                    onClick={() => {
                                        setSelectedSettlement(s);
                                        setAmount(s.amount.toString());
                                    }}
                                    className={`flex items-center gap-3.5 p-3.5 rounded-[16px] cursor-pointer border transition-all ${selectedSettlement === s ? 'bg-accent-dim border-accent shadow-lg shadow-accent/10 translate-x-1' : 'bg-white/5 border-transparent hover:bg-white/10'}`}
                                >
                                    <Avatar initials={s.to_user_name.substring(0,2).toUpperCase()} color="#6366f1" size={40} />
                                    <div className="flex-1">
                                        <div className="text-sm font-bold text-text-primary">Pay {s.to_user_name}</div>
                                        <div className="text-xs text-text-muted mt-0.5">Suggested: ₹{s.amount}</div>
                                    </div>
                                    {selectedSettlement === s && <div className="text-accent text-lg">✓</div>}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="bg-green-dim/30 border border-green/20 rounded-[16px] p-5 text-center mb-8">
                        <div className="text-sm font-bold text-green mb-1">🎉 You're all settled!</div>
                        <div className="text-xs text-green/70">No suggested payments for this group.</div>
                    </div>
                ) }

                <div className="space-y-6">
                    <div>
                        <label className="block text-[0.7rem] font-bold uppercase tracking-widest text-text-muted mb-2 px-1">Amount to Pay</label>
                        <div className="relative group">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-bold text-lg group-focus-within:text-accent transition">₹</span>
                            <input 
                                type="number" 
                                value={amount} 
                                onChange={e => setAmount(e.target.value)} 
                                placeholder="0.00"
                                className="w-full bg-bg-input border border-border text-text-primary pl-9 pr-4 py-4 rounded-[16px] text-xl font-bold outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[0.7rem] font-bold uppercase tracking-widest text-text-muted mb-3 px-1">Payment Method</label>
                        <div className="grid grid-cols-3 gap-2.5">
                            {['Cash', 'UPI', 'Wallet'].map(m => (
                                <button
                                    key={m}
                                    onClick={() => setMethod(m.toLowerCase())}
                                    className={`py-3 rounded-[12px] text-xs font-bold border transition-all ${method === m.toLowerCase() ? 'bg-accent text-white border-accent shadow-md shadow-accent/20' : 'bg-white/5 border-transparent text-text-secondary hover:bg-white/10'}`}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 mt-10">
                    <button onClick={onClose} className="flex-1 px-5 py-3.5 rounded-[16px] text-sm font-bold bg-bg-card text-text-primary border border-border hover:bg-bg-card-hover transition">Cancel</button>
                    <button 
                        disabled={loading || !selectedSettlement} 
                        onClick={handleSettle} 
                        className="flex-[2] px-5 py-3.5 rounded-[16px] text-sm font-bold bg-accent text-white hover:bg-[#5254cc] shadow-xl shadow-accent/30 transition disabled:opacity-50 disabled:shadow-none"
                    >
                        {loading ? 'Processing...' : `Settle Up →`}
                    </button>
                </div>
            </div>
        </div>
    );
}
