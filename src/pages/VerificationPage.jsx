import { useState } from 'react';
import { VERIFY_EXPENSES as INITIAL_VERIFY, formatDate } from '../data/mockData';
import { useToast } from '../components/ToastProvider';

export default function VerificationPage() {
    const [items, setItems] = useState(INITIAL_VERIFY.map(v => ({ ...v, removing: false })));
    const showToast = useToast();

    const handleAction = (id, action) => {
        const exp = items.find(v => v.id === id);
        if (!exp) return;
        setItems(prev => prev.map(v => v.id === id ? { ...v, removing: true } : v));
        setTimeout(() => setItems(prev => prev.filter(v => v.id !== id)), 300);
        if (action === 'approve') showToast('success', 'Approved!', `₹${exp.amount.toLocaleString()} expense by ${exp.submittedBy} approved`);
        else showToast('error', 'Rejected', `Expense "${exp.desc}" has been rejected`);
    };

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-7">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Expense Verification</h1>
                    <p className="text-text-secondary text-sm mt-1">{items.length} expenses pending admin review</p>
                </div>
            </div>
            <div className="grid grid-cols-3 gap-5">
                {items.map(v => (
                    <div key={v.id} className={`bg-bg-card border border-border rounded-[20px] overflow-hidden transition-all ${v.removing ? 'opacity-0 scale-95' : 'animate-fade-up'}`} style={{ transition: 'all 0.3s ease' }}>
                        {/* Receipt Header */}
                        <div className="relative bg-gradient-to-br from-bg-secondary to-bg-card text-center py-10 px-6">
                            <span className="text-[4rem]">{v.receipt}</span>
                            <div className="absolute top-3.5 right-3.5">
                                <span className="inline-flex items-center gap-[5px] px-2.5 py-[3px] rounded-full text-xs font-semibold bg-yellow-dim text-yellow">Pending Review</span>
                            </div>
                        </div>
                        {/* Body */}
                        <div className="p-6">
                            <div className="text-2xl font-extrabold mb-1.5">₹{v.amount.toLocaleString()}</div>
                            <div className="text-[0.95rem] font-semibold text-text-secondary mb-4">{v.desc}</div>
                            {[
                                { l: 'Submitted by', r: v.submittedBy },
                                { l: 'Group', r: v.group },
                                { l: 'Date', r: formatDate(v.date) },
                            ].map(d => (
                                <div key={d.l} className="flex justify-between py-1.5 text-sm">
                                    <span className="text-text-muted">{d.l}</span>
                                    <span className="font-medium">{d.r}</span>
                                </div>
                            ))}
                            {v.note && <div className="bg-bg-secondary rounded-[10px] px-3 py-2.5 text-xs text-text-muted my-3">📝 {v.note}</div>}
                            <div className="flex gap-2.5 mt-5">
                                <button onClick={() => handleAction(v.id, 'reject')} className="flex-1 px-3.5 py-2 rounded-[10px] text-sm font-semibold bg-red-dim text-red border border-[rgba(239,68,68,0.3)] hover:bg-[rgba(239,68,68,0.2)] transition">✕ Reject</button>
                                <button onClick={() => handleAction(v.id, 'approve')} className="flex-1 px-3.5 py-2 rounded-[10px] text-sm font-semibold bg-green-dim text-green border border-[rgba(34,197,94,0.3)] hover:bg-[rgba(34,197,94,0.2)] transition">✓ Approve</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
