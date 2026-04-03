import { useState } from 'react';
import { SETTLEMENTS as INIT_SETTLEMENTS } from '../data/mockData';
import { SummaryCard, Avatar } from '../components/ui';
import { useToast } from '../components/ToastProvider';

const flowPeople = [
    { name: 'Rohan', color: '#6366f1', initials: 'RK' },
    { name: 'Priya', color: '#22c55e', initials: 'PS' },
    { name: 'Anita', color: '#3b82f6', initials: 'AD' },
    { name: 'Ketan', color: '#f59e0b', initials: 'KS' },
    { name: 'Sneha', color: '#ec4899', initials: 'SP' },
];
const flowArrows = [
    { from: 'Rohan', to: 'Priya', amount: '₹1,840' },
    { from: 'Anita', to: 'Priya', amount: '₹720' },
    { from: 'Priya', to: 'Ketan', amount: '₹560' },
    { from: 'Sneha', to: 'Rohan', amount: '₹940' },
];

export default function SettlementsPage() {
    const [settlements, setSettlements] = useState(INIT_SETTLEMENTS.map(s => ({ ...s })));
    const showToast = useToast();

    const markSettled = (id) => {
        const s = settlements.find(x => x.id === id);
        if (!s) return;
        setSettlements(prev => prev.map(x => x.id === id ? { ...x, removing: true } : x));
        setTimeout(() => setSettlements(prev => prev.filter(x => x.id !== id)), 300);
        showToast('success', 'Payment Recorded!', `₹${s.amount.toLocaleString()} from ${s.from} to ${s.to} settled`);
    };

    const recalculate = () => {
        showToast('info', 'Recalculating…', 'Settlement graph is being optimized');
        setTimeout(() => showToast('success', 'Done!', 'Settlement plan updated with latest balances'), 1800);
    };

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-7">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Settlements</h1>
                    <p className="text-text-secondary text-sm mt-1">Optimized payment plan to minimize transactions</p>
                </div>
                <button onClick={recalculate} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-sm font-semibold bg-accent text-white hover:bg-[#5254cc] transition">🧮 Recalculate</button>
            </div>

            <div className="grid grid-cols-3 gap-5 mb-8">
                <SummaryCard icon="💸" iconBg="rgba(99,102,241,0.15)" label="Total to Settle" value="₹5,260" colorClass="purple" />
                <SummaryCard icon="🔄" iconBg="rgba(245,158,11,0.12)" label="Pending Transfers" value="5" colorClass="yellow" />
                <SummaryCard icon="✅" iconBg="rgba(34,197,94,0.12)" label="Settled This Month" value="₹12,400" colorClass="green" />
            </div>

            {/* Flow Graph */}
            <div className="bg-bg-card border border-border rounded-[20px] p-6 mb-6">
                <div className="text-[0.95rem] font-semibold mb-5">Optimized Payment Flow</div>
                <div className="flex flex-wrap gap-4 items-center justify-center w-full mb-5">
                    {flowPeople.map(p => (
                        <div key={p.name} className="flex flex-col items-center gap-2">
                            <Avatar initials={p.initials} color={p.color} size={48} />
                            <span className="text-xs font-medium text-text-secondary">{p.name}</span>
                        </div>
                    ))}
                </div>
                <div className="flex flex-wrap gap-2.5 justify-center">
                    {flowArrows.map((a, i) => (
                        <div key={i} className="flex items-center gap-1.5 bg-bg-secondary rounded-full px-3.5 py-1.5 text-xs">
                            <span className="font-semibold">{a.from}</span>
                            <span className="text-accent">→</span>
                            <span className="font-semibold text-green">{a.to}</span>
                            <span className="ml-1 text-yellow font-bold">{a.amount}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Settlement List */}
            <div className="flex flex-col gap-2.5">
                {settlements.map(s => (
                    <div key={s.id} className={`flex items-center gap-4 p-5 bg-bg-card border border-border rounded-[14px] hover:border-white/10 transition ${s.removing ? 'opacity-0' : ''}`} style={{ transition: 'opacity 0.3s' }}>
                        <Avatar initials={s.from.substring(0, 2)} color={s.fromColor} size={42} />
                        <div className="flex-1">
                            <div className="text-[0.95rem] font-semibold flex items-center gap-2">
                                <span>{s.from}</span><span className="text-text-muted">→</span><span className="text-green">{s.to}</span>
                            </div>
                            <div className="text-xs text-text-muted mt-0.5">via {s.via}</div>
                        </div>
                        <div className="text-lg font-extrabold text-red">₹{s.amount.toLocaleString()}</div>
                        <div className="flex gap-2">
                            <button onClick={() => markSettled(s.id)} className="px-3.5 py-1.5 rounded-[10px] text-xs font-semibold bg-green-dim text-green border border-[rgba(34,197,94,0.3)] hover:bg-[rgba(34,197,94,0.2)] transition">Mark Paid</button>
                            <button onClick={() => showToast('info', 'Reminder', `Payment reminder sent to ${s.from}!`)} className="px-3.5 py-1.5 rounded-[10px] text-xs font-semibold text-text-secondary bg-transparent border border-border hover:bg-white/5 transition">Remind</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
