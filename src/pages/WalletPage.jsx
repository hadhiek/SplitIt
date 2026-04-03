import { WALLET_TRANSACTIONS } from '../data/mockData';
import { SummaryCard } from '../components/ui';
import { useToast } from '../components/ToastProvider';

export default function WalletPage() {
    const showToast = useToast();
    const actions = [
        { icon: '📤', label: 'Send', onClick: () => showToast('info', 'Send Money', 'Coming soon! Connect your UPI ID.') },
        { icon: '📥', label: 'Request', onClick: () => showToast('info', 'Request', 'Payment request feature coming soon!') },
        { icon: '➕', label: 'Top Up', onClick: () => showToast('success', 'Top Up', 'Added ₹2,000 to your wallet') },
        { icon: '📊', label: 'History', onClick: () => showToast('info', 'History', 'Full history download coming soon!') },
    ];

    return (
        <div className="animate-fade-in">
            <div className="mb-7">
                <h1 className="text-2xl font-bold tracking-tight">Wallet</h1>
                <p className="text-text-secondary text-sm mt-1">Manage your SplitIt balance</p>
            </div>

            <div className="grid grid-cols-3 gap-5 mb-8">
                <SummaryCard icon="💳" iconBg="rgba(99,102,241,0.15)" label="Wallet Balance" value="₹4,280" colorClass="purple" change={{ up: true, text: '↑ 12% from last month' }} />
                <SummaryCard icon="📈" iconBg="rgba(34,197,94,0.12)" label="Total Received" value="₹24,600" colorClass="green" valueClass="text-green" />
                <SummaryCard icon="📉" iconBg="rgba(239,68,68,0.12)" label="Total Sent" value="₹20,320" colorClass="red" valueClass="text-red" />
            </div>

            <div className="grid grid-cols-3 gap-5 items-start">
                {/* Transactions */}
                <div className="col-span-2 bg-bg-card border border-border rounded-[20px] p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div className="text-[0.95rem] font-semibold">Recent Transactions</div>
                        <button className="text-xs text-accent-light hover:underline">View All</button>
                    </div>
                    {WALLET_TRANSACTIONS.map((t, i) => (
                        <div key={i} className="flex items-center gap-3.5 py-3 border-b border-border last:border-b-0 hover:bg-white/[0.02] transition">
                            <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center text-lg shrink-0 ${t.type === 'credit' ? 'bg-green-dim' : 'bg-red-dim'}`}>{t.icon}</div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold truncate">{t.name}</div>
                                <div className="text-xs text-text-muted mt-0.5">{t.date}</div>
                            </div>
                            <div className={`text-sm font-bold ${t.amount > 0 ? 'text-green' : 'text-red'}`}>
                                {t.amount > 0 ? '+' : ''}₹{Math.abs(t.amount).toLocaleString()}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Quick Actions */}
                <div className="bg-bg-card border border-border rounded-[20px] p-6">
                    <div className="text-[0.95rem] font-semibold mb-5">Quick Actions</div>
                    <div className="grid grid-cols-2 gap-3">
                        {actions.map(a => (
                            <button key={a.label} onClick={a.onClick} className="flex flex-col items-center gap-2 p-5 rounded-[14px] border border-border hover:border-[rgba(99,102,241,0.3)] hover:bg-accent-dim transition cursor-pointer text-center">
                                <span className="text-2xl">{a.icon}</span>
                                <span className="text-xs font-semibold">{a.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Balance Progress */}
                    <div className="mt-6 pt-6 border-t border-border">
                        <div className="text-xs text-text-muted mb-3">Monthly Budget Usage</div>
                        {[
                            { label: 'Food & Dining', pct: 68, color: '#22c55e' },
                            { label: 'Transport', pct: 42, color: '#f59e0b' },
                            { label: 'Entertainment', pct: 85, color: '#ec4899' },
                        ].map(b => (
                            <div key={b.label} className="mb-3 last:mb-0">
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-text-secondary">{b.label}</span>
                                    <span style={{ color: b.color }}>{b.pct}%</span>
                                </div>
                                <div className="h-[6px] bg-bg-input rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${b.pct}%`, background: b.color }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
