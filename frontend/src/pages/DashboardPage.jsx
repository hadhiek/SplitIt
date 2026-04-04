import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { SummaryCard, StatusBadge } from '../components/ui';

// Helper for date formatting
function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function DashboardPage() {
    const { user } = useAuth();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchDashboard() {
            try {
                // Fetch profile to get real full name and ensure user row is synced
                const profileRes = await api.get('/api/users/me');
                setProfile(profileRes.data);
            } catch (err) {
                console.error("Failed to load dashboard data", err);
            } finally {
                setLoading(false);
            }
        }
        fetchDashboard();
    }, []);

    // Temporarily keeping mock data for visual sections that aren't hooked to backend yet
    const recent = []; 
    const pending = [];

    const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';

    if (loading) {
        return <div className="p-8 text-text-muted">Loading dashboard...</div>;
    }

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-7">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Good evening, {displayName} 👋</h1>
                    <p className="text-text-secondary text-sm mt-1">Here's your financial overview for today</p>
                </div>
                <div className="flex gap-2.5">
                    <Link to="/analytics" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-sm font-semibold bg-bg-card text-text-primary border border-border hover:bg-bg-card-hover transition">📊 Analytics</Link>
                    <Link to="/add-expense" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-sm font-semibold bg-accent text-white hover:bg-[#5254cc] hover:-translate-y-0.5 transition">+ Add Expense</Link>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-5 mb-8">
                <SummaryCard icon="💳" iconBg="rgba(99,102,241,0.15)" label="Wallet Balance" value="₹0" colorClass="purple" change={{ up: true, text: 'Active' }} />
                <SummaryCard icon="📤" iconBg="rgba(239,68,68,0.12)" label="You Owe" value="₹0" colorClass="red" valueClass="text-red" change={{ text: '0 payments' }} />
                <SummaryCard icon="📥" iconBg="rgba(34,197,94,0.12)" label="You Are Owed" value="₹0" colorClass="green" valueClass="text-green" change={{ up: true, text: 'From 0 people' }} />
                <SummaryCard icon="👥" iconBg="rgba(59,130,246,0.12)" label="Active Groups" value="0" colorClass="blue" change={{ text: '0 pending expenses' }} />
            </div>

            {/* Two Column */}
            <div className="grid grid-cols-2 gap-5 mb-8">
                {/* Recent Expenses */}
                <div className="bg-bg-card border border-border rounded-[20px] p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <div className="text-[0.95rem] font-semibold">Recent Expenses</div>
                            <div className="text-xs text-text-muted mt-0.5">Last 7 days</div>
                        </div>
                        <Link to="/expenses" className="text-xs text-accent-light hover:underline">View All</Link>
                    </div>
                    {recent.length === 0 && <div className="text-sm text-text-muted py-4">No recent expenses found.</div>}
                    {recent.map(e => (
                        <div key={e.id} className="flex items-center gap-4 py-3.5 border-b border-border last:border-b-0 hover:bg-white/[0.02] transition cursor-pointer">
                            <div className="w-10 h-10 rounded-[10px] bg-[rgba(99,102,241,0.1)] flex items-center justify-center text-lg shrink-0">{e.cat}</div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold truncate">{e.desc}</div>
                                <div className="flex items-center gap-2.5 mt-0.5">
                                    <span className="text-xs text-text-muted">{e.group}</span>
                                    <span className="text-text-muted">·</span>
                                    <span className="text-xs text-text-muted">{formatDate(e.date)}</span>
                                    <StatusBadge status={e.status} />
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <div className="text-sm font-bold">₹{e.amount.toLocaleString()}</div>
                                <div className={`text-xs mt-0.5 ${e.paidBy === 'Priya' ? 'text-green font-bold' : 'text-red font-bold'}`}>
                                    {e.paidBy === 'Priya' ? 'you paid' : `you owe ₹${e.share}`}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Pending Approvals */}
                <div className="bg-bg-card border border-border rounded-[20px] p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <div className="text-[0.95rem] font-semibold">Pending Approvals</div>
                            <div className="text-xs text-text-muted mt-0.5">Awaiting your review</div>
                        </div>
                        <span className="inline-flex items-center gap-[5px] px-2.5 py-[3px] rounded-full text-xs font-semibold bg-yellow-dim text-yellow">0 pending</span>
                    </div>
                    {pending.length === 0 && <div className="text-sm text-text-muted py-4">You have no pending approvals.</div>}
                    {pending.map(v => (
                        <div key={v.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-b-0">
                            <span className="text-2xl">{v.receipt}</span>
                            <div className="flex-1">
                                <div className="text-sm font-semibold">{v.desc}</div>
                                <div className="text-xs text-text-muted">{v.submittedBy} · {v.group}</div>
                            </div>
                            <div className="text-sm font-bold text-yellow">₹{v.amount.toLocaleString()}</div>
                        </div>
                    ))}
                    <Link to="/verification" className="mt-3.5 w-full inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-[10px] text-xs font-semibold bg-yellow-dim text-yellow border border-[rgba(245,158,11,0.3)] hover:bg-[rgba(245,158,11,0.2)] transition">
                        Review All →
                    </Link>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="mb-8">
                <h3 className="text-base font-bold mb-4">Quick Actions</h3>
                <div className="flex gap-2.5 flex-wrap">
                    {[
                        { to: '/add-expense', icon: '➕', label: 'Add Expense' },
                        { to: '/groups', icon: '👥', label: 'Create Group' },
                        { to: '/settlements', icon: '⚡', label: 'Settle Up' },
                        { to: '/wallet', icon: '💳', label: 'Add Money' },
                        { to: '/analytics', icon: '📊', label: 'View Report' },
                    ].map(a => (
                        <Link key={a.to} to={a.to} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-sm font-semibold bg-bg-card text-text-primary border border-border hover:bg-bg-card-hover transition">
                            {a.icon} {a.label}
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
