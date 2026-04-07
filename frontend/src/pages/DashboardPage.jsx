import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { SummaryCard, StatusBadge } from '../components/ui';
import { useToast } from '../components/ToastProvider';

// Helper for date formatting
function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
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
            showToast('success', 'Request Sent! 🎉', `Your join request for "${res.data.group_name || 'the group'}" has been sent to the admin.`);
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
                <p className="text-xs text-text-muted mb-6">Ask the group admin to share their 8-character invite code with you.</p>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 px-5 py-2.5 rounded-[10px] text-sm font-semibold bg-bg-card text-text-primary border border-border hover:bg-bg-card-hover transition">Cancel</button>
                    <button disabled={loading} onClick={handleJoin} className="flex-[2] px-5 py-2.5 rounded-[10px] text-sm font-semibold bg-accent text-white hover:bg-[#5254cc] transition disabled:opacity-50">
                        {loading ? 'Submitting...' : 'Send Join Request →'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function DashboardPage() {
    const { user } = useAuth();
    const showToast = useToast();
    const [profile, setProfile] = useState(null);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [joinModalOpen, setJoinModalOpen] = useState(false);
    const [myRequests, setMyRequests] = useState([]);

    useEffect(() => {
        async function fetchDashboard() {
            try {
                // Fetch basic profile
                const profileRes = await api.get('/api/users/me');
                setProfile(profileRes.data);

                // Fetch dashboard summary (real data)
                const summaryRes = await api.get('/api/users/me/dashboard-summary');
                setSummary(summaryRes.data);

                // Fetch user's join requests to show rejected/accepted notifications
                const reqRes = await api.get('/api/users/me/join-requests');
                setMyRequests(reqRes.data);

                // Show toasts for recently responded requests
                for (const req of reqRes.data) {
                    if (req.status === 'rejected' && req.responded_at) {
                        showToast('error', 'Request Rejected', `Your request to join "${req.group_name || 'a group'}" was rejected.`);
                    }
                }
            } catch (err) {
                console.error("Failed to load dashboard data", err);
            } finally {
                setLoading(false);
            }
        }
        fetchDashboard();
    }, []);

    const recent = summary?.recent_expenses || []; 
    const pendingRequests = myRequests.filter(r => r.status === 'pending');

    const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';

    if (loading) {
        return <div className="p-8 text-text-muted">Loading dashboard...</div>;
    }

    // Category mapping for icons
    const catIcons = {
        'Food & Dining': <img src="../../logo/pizza.png"/>,
        'Accomadation': <img src="../../logo/accomodation.png"/>,
        'Health': <img src="../../logo/health.png"/>,
        'Transport': <img src="../../logo/transportation.png"/>,
        'Shopping': <img src="../../logo/shopping.png"/>,
        'Entertainment': <img src="../../logo/entertainment.png"/>,
        'Bills': <img src="../../logo/bill.png"/>,
        'Other': <img src="../../logo/box.png"/>
    };

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-7">
                <div>
                    <h1 className="flex items-center text-2xl font-bold tracking-tight">Good evening, {displayName}<img className='ml-3' src="../../logo/hand.png"></img></h1>
                    <p className="text-text-secondary text-sm mt-1">Here's your financial overview for today</p>
                </div>
                <div className="flex gap-2.5">
                    <button onClick={() => setJoinModalOpen(true)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-sm font-semibold bg-bg-card text-text-primary border border-border hover:bg-bg-card-hover transition">🔗 Join Group</button>
                    <Link to="/add-expense" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-sm font-semibold bg-accent text-white hover:bg-[#5254cc] hover:-translate-y-0.5 transition">+ Add Expense</Link>
                </div>
            </div>

            {/* Pending Join Requests Banner */}
            {pendingRequests.length > 0 && (
                <div className="bg-yellow-dim border border-[rgba(245,158,11,0.3)] rounded-[14px] p-4 mb-6 animate-fade-in">
                    <div className="text-sm font-semibold text-yellow mb-1">⏳ Pending Join Requests</div>
                    {pendingRequests.map(r => (
                        <div key={r.id} className="text-xs text-text-secondary">
                            Waiting for admin approval to join <span className="font-semibold text-text-primary">{r.group_emoji || '👥'} {r.group_name || `Group #${r.group_id}`}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-5 mb-8">
                <SummaryCard 
                    icon="../../logo/group.png"
                    iconBg="rgba(99,102,241,0.15)" 
                    label="Active Groups" 
                    value={summary?.groups_count || 0} 
                    colorClass="purple" 
                    change={{ text: 'Syncing live' }} 
                />
                <SummaryCard 
                    icon="../../logo/you_owe.png" 
                    iconBg="rgba(239,68,68,0.12)" 
                    label="You Owe" 
                    value={`₹${summary?.total_owe || 0}`} 
                    colorClass="red" 
                    valueClass="text-red" 
                    change={{ text: 'To be settled' }} 
                />
                <SummaryCard 
                    icon="../../logo/owed.png"
                    iconBg="rgba(34,197,94,0.12)" 
                    label="You Are Owed" 
                    value={`₹${summary?.total_owed || 0}`} 
                    colorClass="green" 
                    valueClass="text-green" 
                    change={{ up: true, text: 'Expected back' }} 
                />
                <SummaryCard 
                    icon="../../logo/approval.png"
                    iconBg="rgba(59,130,246,0.12)" 
                    label="Approvals" 
                    value={summary?.pending_approvals_count || 0} 
                    colorClass="blue" 
                    change={{ text: 'Awaiting you' }} 
                />
            </div>

            {/* Two Column */}
            <div className="grid grid-cols-2 gap-5 mb-8">
                {/* Recent Expenses */}
                <div className="bg-bg-card border border-border rounded-[20px] p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <div className="text-[0.95rem] font-semibold">Recent Expenses</div>
                            <div className="text-xs text-text-muted mt-0.5">Your latest activity</div>
                        </div>
                        <Link to="/expenses" className="text-xs text-accent-light hover:underline">View All</Link>
                    </div>
                    {recent.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-10 text-center opacity-50">
                            <div className="text-3xl mb-2"><img src="../../logo/you_owe.png" /></div> {/*no payment */}
                            <div className="text-sm">No expenses yet.</div>
                        </div>
                    )}
                    {recent.map(e => (
                        <div key={e.id} onClick={() => window.location.href=`/groups/${e.group_id}`} className="flex items-center gap-4 py-3.5 border-b border-border last:border-b-0 hover:bg-white/[0.02] transition cursor-pointer">
                            <div className="w-10 h-10 rounded-[10px] bg-[rgba(99,102,241,0.1)] flex items-center justify-center text-lg shrink-0">
                                {catIcons[e.category] || <img src="../../logo/box.png"/>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold truncate">{e.description}</div>
                                <div className="flex items-center gap-2.5 mt-0.5">
                                    <span className="text-xs text-text-muted">{e.group_emoji} {e.group_name}</span>
                                    <span className="text-text-muted opacity-50">·</span>
                                    <span className="text-xs text-text-muted">{formatDate(e.expense_date)}</span>
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <div className="text-sm font-bold">₹{e.amount}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Pending Approvals Widget */}
                <div className="bg-bg-card border border-border rounded-[20px] p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <div className="text-[0.95rem] font-semibold">Admin Actions</div>
                            <div className="text-xs text-text-muted mt-0.5">Requests from others</div>
                        </div>
                        <span className={`inline-flex items-center gap-[5px] px-2.5 py-[3px] rounded-full text-xs font-semibold ${summary?.pending_approvals_count > 0 ? 'bg-yellow-dim text-yellow' : 'bg-gray-dim text-text-muted'}`}>
                            {summary?.pending_approvals_count || 0} pending
                        </span>
                    </div>
                    {summary?.pending_approvals_count === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center opacity-50">
                            <div className="text-3xl mb-2"><img src="../../logo/tick.png"/></div>
                            <div className="text-sm">All caught up!</div>
                        </div>
                    ) : (
                        <div className="py-2">
                            <p className="text-sm text-text-secondary leading-relaxed">
                                You have <span className="font-bold text-text-primary text-yellow">{summary.pending_approvals_count}</span> pending request{summary.pending_approvals_count > 1 ? 's' : ''} to join groups you manage.
                            </p>
                            <Link to="/groups" className="inline-block mt-4 text-xs font-bold text-accent-light uppercase tracking-wider hover:underline">
                                Go to Groups to Review →
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="mb-8">
                <h3 className="text-base font-bold mb-4">Quick Actions</h3>
                <div className="flex gap-2.5 flex-wrap">
                    {[
                        { icon: <img src="../../logo/add.png"/>, label: 'Add Expense', action: () => window.location.href = '/add-expense' },
                        { icon: <img src="../../logo/link.png"/>, label: 'Create Group', action: () => window.location.href = '/groups' },
                        { icon: '🔗', label: 'Join Group', action: () => setJoinModalOpen(true) },
                    ].map(a => (
                        <button key={a.label} onClick={a.action} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-sm font-semibold bg-bg-card text-text-primary border border-border hover:bg-bg-card-hover transition">
                            {a.icon} {a.label}
                        </button>
                    ))}
                </div>
            </div>

            <JoinGroupModal open={joinModalOpen} onClose={() => setJoinModalOpen(false)} />
        </div>
    );
}
