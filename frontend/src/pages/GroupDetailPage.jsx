import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { StatusBadge, Badge, Avatar } from '../components/ui';
import { useToast } from '../components/ToastProvider';
import SettleUpModal from '../components/SettleUpModal';
import GiveMoneyModal from '../components/GiveMoneyModal';

export default function GroupDetailPage() {
    const { id } = useParams();
    const { user } = useAuth();
    const [group, setGroup] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('members');
    const [joinRequests, setJoinRequests] = useState([]);
    const [requestsLoading, setRequestsLoading] = useState(false);
    const [codeCopied, setCodeCopied] = useState(false);
    const [balances, setBalances] = useState(null);
    const [settlementsHistory, setSettlementsHistory] = useState([]);
    const [settleModalOpen, setSettleModalOpen] = useState(false);
    const [giveMoneyModalOpen, setGiveMoneyModalOpen] = useState(false);
    const [loans, setLoans] = useState([]);
    const [loansLoading, setLoansLoading] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const navigate = useNavigate();
    const showToast = useToast();

    const isAdmin = group?.members?.some(
        m => m.user_id === user?.id && m.role === 'admin'
    );

    const fetchBalances = () => {
        api.get(`/api/settlements/balances/${id}`)
            .then(res => setBalances(res.data))
            .catch(err => console.error("Balance fetch error:", err));
    };

    useEffect(() => {
        setLoading(true);
        setError(null);
        api.get(`/api/groups/${id}`)
            .then(res => setGroup(res.data))
            .catch(err => {
                console.error(err);
                setError(err.response?.data?.detail || "Failed to load group details");
                showToast('error', 'Error', 'Failed to load group details');
            })
            .finally(() => setLoading(false));
            
        fetchBalances();
    }, [id]);

    // Fetch join requests/settlements history when switching tabs
    useEffect(() => {
        if (activeTab === 'requests' && isAdmin) {
            setRequestsLoading(true);
            api.get(`/api/groups/${id}/requests`)
                .then(res => setJoinRequests(res.data))
                .catch(err => console.error(err))
                .finally(() => setRequestsLoading(false));
        }
        if (activeTab === 'settlements') {
            setHistoryLoading(true);
            api.get(`/api/settlements/history/${id}`)
                .then(res => setSettlementsHistory(res.data))
                .catch(err => console.error(err))
                .finally(() => setHistoryLoading(false));
        }
        if (activeTab === 'loans') {
            setLoansLoading(true);
            api.get(`/api/loans/${id}`)
                .then(res => setLoans(res.data))
                .catch(err => console.error(err))
                .finally(() => setLoansLoading(false));
        }
    }, [activeTab, isAdmin, id]);

    const handleCopyCode = async () => {
        if (!group?.invite_code) return;
        try {
            await navigator.clipboard.writeText(group.invite_code);
            setCodeCopied(true);
            showToast('success', 'Copied!', 'Invite code copied to clipboard.');
            setTimeout(() => setCodeCopied(false), 2000);
        } catch {
            showToast('error', 'Error', 'Failed to copy code.');
        }
    };

    const handleRequestAction = async (requestId, action) => {
        try {
            await api.post(`/api/groups/${id}/requests/${requestId}/action`, { action });
            showToast('success', action === 'accept' ? 'Accepted!' : 'Rejected', 
                action === 'accept' ? 'User has been added to the group.' : 'Join request has been rejected.');
            // Refresh requests
            setJoinRequests(prev => prev.filter(r => r.id !== requestId));
            // If accepted, refresh group to update member list
            if (action === 'accept') {
                const res = await api.get(`/api/groups/${id}`);
                setGroup(res.data);
            }
        } catch (e) {
            showToast('error', 'Error', e.response?.data?.detail || 'Failed to process request.');
        }
    };

    const handleDeleteGroup = async () => {
        if (!window.confirm(`Are you sure you want to delete "${group.name}"? This action moves the group to history and is only possible if all balances are ₹0.`)) {
            return;
        }

        try {
            await api.delete(`/api/groups/${id}`);
            showToast('success', 'Group Deleted', 'The group has been moved to history.');
            navigate('/groups');
        } catch (e) {
            const msg = e.response?.data?.detail || 'Failed to delete group. Ensure all balances are settled.';
            showToast('error', 'Deletion Failed', msg);
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-text-muted">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-accent mb-4"></div>
            <p className="text-sm font-medium italic">Gathering financials...</p>
        </div>
    );

    if (error || !group) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-bg-card border border-border rounded-[24px]">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold mb-2">Group not found</h2>
            <p className="text-sm text-text-muted mb-6 max-w-[300px]">{error || "This group may have been deleted or you don't have access."}</p>
            <Link to="/groups" className="px-5 py-2.5 bg-accent text-white rounded-[12px] font-semibold hover:opacity-90 transition">Back to Groups</Link>
        </div>
    );

    const memberCount = group.members?.length || 1;
    const tabs = isAdmin ? ['members', 'expenses', 'loans', 'requests', 'settlements'] : ['members', 'expenses', 'loans', 'settlements'];

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-7">
                <div className="flex items-center gap-3">
                    <Link to="/groups" className="inline-flex items-center px-2.5 py-2.5 rounded-[10px] text-text-secondary hover:bg-white/5 hover:text-text-primary transition">←</Link>
                    <div>
                        <div className="flex items-center gap-4">
                            <h1 className="text-2xl font-bold">{group.emoji || '👥'} {group.name}</h1>
                            {isAdmin && group.invite_code && (
                                <div className="flex items-center gap-2 bg-accent-dim border border-[rgba(99,102,241,0.3)] rounded-[8px] px-3 py-1 mt-1">
                                    <span className="text-[0.65rem] text-accent-light font-semibold uppercase tracking-wider opacity-80 mt-[1px]">Invite Code:</span>
                                    <span className="font-mono font-bold text-sm tracking-widest text-accent-light">{group.invite_code}</span>
                                    <button onClick={handleCopyCode} className="ml-1 text-accent-light opacity-60 hover:opacity-100 transition text-sm" title="Copy Code">
                                        {codeCopied ? '✓' : '📋'}
                                    </button>
                                </div>
                            )}
                        </div>
                        <p className="text-text-secondary text-sm mt-1">{memberCount} Members</p>
                    </div>
                </div>
                <div className="flex gap-2.5">
                    <button className="px-5 py-2.5 rounded-[10px] text-sm font-semibold bg-bg-card text-text-primary border border-border hover:bg-bg-card-hover transition">⚙ Settings</button>
                    {isAdmin && group.is_active !== false && (
                        <button 
                            onClick={handleDeleteGroup}
                            className="px-5 py-2.5 rounded-[10px] text-sm font-semibold bg-red-dim text-red border border-[rgba(239,68,68,0.2)] hover:bg-[rgba(239,68,68,0.3)] transition inline-flex items-center gap-2"
                        >
                            🗑 Delete
                        </button>
                    )}
                    {group.is_active !== false && (
                        <>
                            <button 
                                onClick={() => setGiveMoneyModalOpen(true)}
                                className="px-5 py-2.5 rounded-[10px] text-sm font-semibold bg-yellow-dim text-yellow border border-[rgba(245,158,11,0.3)] hover:bg-[rgba(245,158,11,0.2)] transition inline-flex items-center gap-2"
                            >
                                💰 Give Money
                            </button>
                            <button 
                                onClick={() => setSettleModalOpen(true)}
                                className="px-5 py-2.5 rounded-[10px] text-sm font-semibold bg-green-dim text-green border border-[rgba(34,197,94,0.3)] hover:bg-[rgba(34,197,94,0.2)] transition inline-flex items-center gap-2"
                            >
                                ₹ Settle Up
                            </button>
                            <Link to="/add-expense" className="px-5 py-2.5 rounded-[10px] text-sm font-semibold bg-accent text-white hover:bg-[#5254cc] transition inline-flex items-center gap-2">+ Add Expense</Link>
                        </>
                    )}
                </div>
            </div>



            {/* Inactive Banner */}
            {group.is_active === false && (
                <div className="bg-bg-card border border-red/30 rounded-[14px] px-6 py-4 mb-6 flex items-center gap-4 text-red border-dashed">
                    <span className="text-2xl">📜</span>
                    <div>
                        <div className="font-bold">This group is inactive</div>
                        <div className="text-xs opacity-70">This group has been deleted and is now in read-only history mode. No new expenses can be added.</div>
                    </div>
                </div>
            )}

            {/* Stats Row */}
            <div className="bg-bg-card border border-border rounded-[20px] px-6 py-5 mb-6">
                <div className="flex gap-6 items-center px-6">
                    {[
                        { label: 'Total Spent', value: `₹${balances?.total_spent || 0}` },
                        { label: 'You Paid', value: `₹${balances?.user_paid || 0}`, cls: 'text-green' },
                        { label: 'Your Share', value: `₹${balances?.user_share || 0}` },
                        { 
                            label: 'Balance', 
                            value: balances?.user_balance > 0 ? `+₹${balances?.user_balance}` : `₹${Math.abs(balances?.user_balance || 0)}`, 
                            cls: (balances?.user_balance > 0.01) ? 'text-green' : (balances?.user_balance < -0.01) ? 'text-red' : 'text-text-muted' 
                        },
                    ].map((s, i) => (
                        <div key={s.label} className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <div className="text-xs text-text-muted">{s.label}</div>
                                <div className={`text-sm font-bold ${s.cls || ''}`}>{s.value}</div>
                            </div>
                            {i < 3 && <div className="w-px h-[30px] bg-border" />}
                        </div>
                    ))}
                    <div className="flex items-center gap-2 ml-auto">
                        <div className="text-xs text-text-muted">Status</div>
                        <Badge color={group.is_active === false ? 'gray' : 'green'}>{group.is_active === false ? 'Inactive' : 'Active'}</Badge>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-bg-card border border-border rounded-[14px] p-1 w-fit mb-7">
                    {tabs.map(t => (
                        <button key={t} onClick={() => setActiveTab(t)} className={`px-5 py-2 rounded-[10px] text-sm font-semibold transition capitalize ${activeTab === t ? 'bg-accent text-white' : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'}`}>
                            {t === 'expenses' ? '📋' : t === 'members' ? '👥' : t === 'requests' ? '📩' : t === 'loans' ? '💰' : '⚡'} {t}
                            {t === 'requests' && joinRequests.length > 0 && (
                                <span className="ml-1.5 bg-red text-white text-[0.65rem] font-bold px-[6px] py-[1px] rounded-full">{joinRequests.length}</span>
                            )}
                        </button>
                    ))}
            </div>

            {/* Tab Content: Members */}
            {activeTab === 'members' && (
                <div className="bg-bg-card border border-border rounded-[20px] p-6 animate-fade-in">
                    {group.members?.map(m => {
                        const name = m.user?.full_name || 'Unknown User';
                        const initials = name.substring(0,2).toUpperCase();
                        const userBalance = balances?.members_balances?.find(ub => ub.user_id === m.user_id)?.net_balance || 0;
                        return (
                            <div key={m.user_id} className="flex items-center gap-3.5 py-3.5 border-b border-border last:border-b-0">
                                <Avatar initials={initials} color="#6366f1" />
                                <div className="flex-1">
                                    <div className="text-sm font-semibold">{name} <Badge color={m.role === 'admin' ? 'blue' : m.role === 'co-admin' ? 'yellow' : 'gray'}>{m.role}</Badge></div>
                                    <div className="text-xs text-text-muted mt-0.5">{m.user?.email || ''}</div>
                                </div>
                                <div className={`text-sm font-bold ${userBalance > 0.01 ? 'text-green' : userBalance < -0.01 ? 'text-red' : 'text-text-muted'}`}>
                                    {userBalance > 0 ? '+' : ''}₹{Math.abs(userBalance)}
                                </div>
                                <button onClick={() => showToast('info', 'Member', 'Manage member options coming soon!')} className="px-3.5 py-1.5 rounded-[10px] text-xs font-semibold text-text-secondary hover:bg-white/5 transition">···</button>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Tab Content: Expenses */}
            {activeTab === 'expenses' && (
                <div className="overflow-x-auto rounded-[20px] bg-bg-card border border-border animate-fade-in shadow-sm">
                    {group.expenses?.length === 0 ? (
                        <div className="p-12 text-center text-text-muted">
                            <div className="text-3xl mb-3">🧾</div>
                            <div className="text-sm font-semibold text-text-secondary">No expenses yet.</div>
                            <p className="text-xs mt-1">Get started by adding your first cost!</p>
                        </div>
                    ) : (
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    {['Description', 'Payer', 'Total', 'Your Share', 'Status', 'Date'].map(h => (
                                        <th key={h} className="text-[0.65rem] font-bold text-text-muted uppercase tracking-widest px-6 py-4 text-left border-b border-border bg-white/[0.02]">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {group.expenses.map(e => {
                                    const mySplit = e.splits?.find(s => s.user_id === user?.id);
                                    const myShare = mySplit ? mySplit.amount_owed : 0;
                                    const iPaid = e.paid_by === user?.id;
                                    const isSettled = Math.abs(balances?.user_balance || 0) < 0.05;

                                    return (
                                        <tr key={e.id} className="border-b border-border last:border-b-0 hover:bg-white/[0.03] transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <span className="w-8 h-8 rounded-lg bg-bg-secondary flex items-center justify-center text-sm shadow-inner">
                                                        {e.category === 'Food' ? '🍔' : e.category === 'Transport' ? '🚕' : '📦'}
                                                    </span>
                                                    <span className="text-sm font-bold text-text-primary group-hover:text-accent transition-colors">{e.description}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-xs font-semibold text-text-secondary">{iPaid ? 'You' : 'Member'}</td>
                                            <td className="px-6 py-4 text-sm font-black text-text-primary">₹{e.amount}</td>
                                            <td className={`px-6 py-4 text-sm font-black ${iPaid ? 'text-green' : 'text-red'}`}>₹{myShare}</td>
                                            <td className="px-6 py-4">
                                                <StatusBadge status={isSettled ? 'settled' : (e.status || 'pending')} />
                                            </td>
                                            <td className="px-6 py-4 text-[0.7rem] font-bold text-text-muted uppercase">
                                                {(() => {
                                                    const d = new Date(e.expense_date || e.created_at);
                                                    return isNaN(d.getTime()) ? 'No Date' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
                                                })()}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* Tab Content: Requests (Admin Only) */}
            {activeTab === 'requests' && isAdmin && (
                <div className="bg-bg-card border border-border rounded-[20px] p-6 animate-fade-in">
                    {requestsLoading ? (
                        <div className="text-sm text-text-muted py-4">Loading requests...</div>
                    ) : joinRequests.length === 0 ? (
                        <div className="text-sm text-text-muted py-4">No pending join requests.</div>
                    ) : (
                        joinRequests.map(r => {
                            const name = r.user?.full_name || 'Unknown User';
                            const initials = name.substring(0, 2).toUpperCase();
                            const requestDate = new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                            return (
                                <div key={r.id} className="flex items-center gap-3.5 py-4 border-b border-border last:border-b-0">
                                    <Avatar initials={initials} color="#f59e0b" />
                                    <div className="flex-1">
                                        <div className="text-sm font-semibold">{name}</div>
                                        <div className="text-xs text-text-muted mt-0.5">Requested on {requestDate}</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleRequestAction(r.id, 'accept')}
                                            className="px-4 py-1.5 rounded-[10px] text-xs font-semibold bg-green-dim text-green border border-[rgba(34,197,94,0.3)] hover:bg-[rgba(34,197,94,0.2)] transition"
                                        >
                                            ✓ Accept
                                        </button>
                                        <button
                                            onClick={() => handleRequestAction(r.id, 'reject')}
                                            className="px-4 py-1.5 rounded-[10px] text-xs font-semibold bg-red-dim text-red border border-[rgba(239,68,68,0.3)] hover:bg-[rgba(239,68,68,0.2)] transition"
                                        >
                                            ✗ Reject
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Tab Content: Settlements */}
            {activeTab === 'settlements' && (
                <div className="bg-bg-card border border-border rounded-[20px] p-6 animate-fade-in">
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
                        <div>
                            <div className="text-sm font-bold">Settlement History</div>
                            <div className="text-xs text-text-muted mt-0.5">Past payments between members</div>
                        </div>
                        <Link 
                            to={`/groups/${id}/settlements`}
                            className="px-4 py-2 rounded-[10px] text-xs font-bold bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition flex items-center gap-2"
                        >
                            🔍 View Optimized Plan
                        </Link>
                    </div>
                    {historyLoading ? (
                        <div className="text-sm text-text-muted py-4">Loading history...</div>
                    ) : settlementsHistory.length === 0 ? (
                        <div className="text-sm text-text-muted py-4 text-center">No settlements yet. Why not clear some debts?</div>
                    ) : (
                        settlementsHistory.map(h => (
                            <div key={h.id} className="flex items-center gap-3.5 py-4 border-b border-border last:border-b-0">
                                <div className="w-10 h-10 rounded-full bg-green/10 flex items-center justify-center text-green text-sm">₹</div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold truncate">
                                        <span className="text-accent-light">{h.from_user_name}</span> paid <span className="text-accent-light">{h.to_user_name}</span>
                                    </div>
                                    <div className="text-xs text-text-muted mt-1">Via {h.payment_method} • {new Date(h.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                                </div>
                                <div className="text-sm font-extrabold text-green">₹{h.amount}</div>
                            </div>
                        ))
                    )}
                </div>
            )}

            <SettleUpModal 
                open={settleModalOpen}
                onClose={() => setSettleModalOpen(false)}
                group={group}
                suggestedSettlements={balances?.suggested_settlements?.filter(s => s.from_user === user?.id) || []}
                onSettled={fetchBalances}
            />

            {/* Loans Tab Content */}
            {activeTab === 'loans' && (
                <div className="bg-bg-card border border-border rounded-[20px] p-6 animate-fade-in">
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
                        <div>
                            <div className="text-sm font-bold">Loan History</div>
                            <div className="text-xs text-text-muted mt-0.5">Money given to the group admin</div>
                        </div>
                        {group.is_active !== false && (
                            <button
                                onClick={() => setGiveMoneyModalOpen(true)}
                                className="px-4 py-2 rounded-[10px] text-xs font-bold bg-yellow-dim text-yellow border border-[rgba(245,158,11,0.2)] hover:bg-[rgba(245,158,11,0.2)] transition flex items-center gap-2"
                            >
                                💰 Give Money
                            </button>
                        )}
                    </div>
                    {loansLoading ? (
                        <div className="text-sm text-text-muted py-4">Loading loans...</div>
                    ) : loans.length === 0 ? (
                        <div className="text-sm text-text-muted py-4 text-center">No loans yet. Use "Give Money" to lend to the admin.</div>
                    ) : (
                        loans.map(loan => (
                            <div key={loan.id} className="flex items-center gap-3.5 py-4 border-b border-border last:border-b-0">
                                <div className="w-10 h-10 rounded-full bg-yellow/10 flex items-center justify-center text-yellow text-sm">💰</div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold truncate">
                                        <span className="text-accent-light">{loan.from_user_name}</span> gave <span className="text-accent-light">{loan.to_user_name}</span>
                                    </div>
                                    <div className="text-xs text-text-muted mt-1">
                                        {loan.note && <span className="italic">"{loan.note}" • </span>}
                                        {new Date(loan.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                    </div>
                                </div>
                                <div className="text-sm font-extrabold text-yellow">₹{loan.amount}</div>
                            </div>
                        ))
                    )}
                </div>
            )}

            <GiveMoneyModal
                open={giveMoneyModalOpen}
                onClose={() => setGiveMoneyModalOpen(false)}
                group={group}
                onSuccess={() => {
                    fetchBalances();
                    // Refresh loans if on loans tab
                    if (activeTab === 'loans') {
                        api.get(`/api/loans/${id}`)
                            .then(res => setLoans(res.data))
                            .catch(err => console.error(err));
                    }
                }}
            />
        </div>
    );
}
