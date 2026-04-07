import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { SummaryCard, Avatar, Badge } from '../components/ui';
import { useToast } from '../components/ToastProvider';

export default function GlobalSettlementsPage() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [markingId, setMarkingId] = useState(null);
    const showToast = useToast();

    const fetchGlobalSettlements = async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/settlements/optimize');
            setData(res.data);
        } catch (err) {
            console.error(err);
            showToast('error', 'Error', 'Failed to load global settlements');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGlobalSettlements();
    }, []);

    const handleMarkPaid = async (groupId, s) => {
        setMarkingId(groupId + s.from_user + s.to_user);
        try {
            await api.post('/api/settlements', {
                group_id: groupId,
                to_user: s.to_user,
                amount: s.amount,
                payment_method: 'cash'
            });
            showToast('success', 'Paid!', `Recorded ₹${s.amount} from ${s.from_user_name} to ${s.to_user_name}`);
            fetchGlobalSettlements();
        } catch (err) {
            showToast('error', 'Error', err.response?.data?.detail || 'Failed to record payment');
        } finally {
            setMarkingId(null);
        }
    };

    if (loading && !data) return <div className="p-8 text-text-muted">Loading your settlement overview...</div>;

    const totalToPay = data?.total_owe || 0;
    const totalToReceive = data?.total_owed || 0;
    const activeGroups = data?.groups?.length || 0;

    return (
        <div className="animate-fade-in pb-20">
            <div className="mb-7">
                <h1 className="text-2xl font-bold tracking-tight">Global Settlements</h1>
                <p className="text-text-secondary text-sm mt-1">Consolidated debt overview across all your workspaces</p>
            </div>

            <div className="grid grid-cols-3 gap-5 mb-10">
                <SummaryCard 
                    icon="../../logo/you_owe.png"
                    iconBg="rgba(239,68,68,0.12)" 
                    label="Total to Pay" 
                    value={`₹${totalToPay}`} 
                    colorClass="red" 
                    valueClass="text-red"
                    change={{ text: 'Urgent' }}
                />
                <SummaryCard 
                    icon="../../logo/owed.png"
                    iconBg="rgba(34,197,94,0.12)" 
                    label="Total to Receive" 
                    value={`₹${totalToReceive}`} 
                    colorClass="green" 
                    valueClass="text-green"
                    change={{ up: true, text: 'Expected' }}
                />
                <SummaryCard 
                    icon="../../logo/group.png" 
                    iconBg="rgba(99,102,241,0.15)" 
                    label="Active Groups" 
                    value={activeGroups} 
                    colorClass="purple" 
                    change={{ text: 'Debts pending' }}
                />
            </div>

            <div className="space-y-8">
                {activeGroups === 0 ? (
                    <div className="bg-bg-card border border-border rounded-[24px] p-16 text-center shadow-sm">
                        <div className="text-5xl mb-4">✨</div>
                        <div className="text-xl font-bold">You're completely settled up!</div>
                        <p className="text-sm text-text-muted mt-2 max-w-sm mx-auto">
                            No outstanding debts found in any of your groups. Enjoy the feeling of clean balances.
                        </p>
                        <Link to="/groups" className="inline-block mt-6 px-6 py-2.5 rounded-[12px] bg-accent text-white font-bold text-sm hover:bg-[#5254cc] transition">
                            Explore Groups
                        </Link>
                    </div>
                ) : (
                    data.groups.map(group => (
                        <div key={group.group_id} className="animate-scale-in">
                            <div className="flex items-center justify-between px-2 mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-[8px] bg-bg-card border border-border flex items-center justify-center text-sm shadow-sm">{group.group_emoji || '👥'}</div>
                                    <h3 className="text-[0.9rem] font-black uppercase tracking-[0.15em] text-text-primary">{group.group_name}</h3>
                                    <Badge color="blue">Plan Optimized</Badge>
                                </div>
                                <Link to={`/groups/${group.group_id}/settlements`} className="text-xs font-bold text-accent-light hover:underline">Full Details →</Link>
                            </div>
                            
                            <div className="space-y-3">
                                {group.settlements.map((s, idx) => (
                                    <div key={idx} className="flex items-center gap-5 p-5 bg-bg-card border border-border rounded-[20px] hover:border-accent/40 shadow-sm transition-all duration-300">
                                        <div className="flex -space-x-3">
                                            <Avatar initials={s.from_user_name.substring(0,2).toUpperCase()} color="#6366f1" size={40} />
                                            <Avatar initials={s.to_user_name.substring(0,2).toUpperCase()} color="#3b82f6" size={40} />
                                        </div>
                                        
                                        <div className="flex-1">
                                            <div className="text-sm font-bold text-text-primary truncate">
                                                {s.from_user_name} <span className="text-text-muted font-normal px-1">pays</span> {s.to_user_name}
                                            </div>
                                            <div className="text-[0.65rem] font-bold text-text-muted mt-1 uppercase tracking-widest">
                                                Recommended Payment
                                            </div>
                                        </div>
                                        
                                        <div className="text-lg font-black text-accent mx-3">₹{s.amount}</div>
                                        
                                        <div className="flex gap-2">
                                            <button 
                                                disabled={markingId === (group.group_id + s.from_user + s.to_user)}
                                                onClick={() => handleMarkPaid(group.group_id, s)} 
                                                className="px-4 py-2 rounded-[10px] text-xs font-bold bg-green-dim text-green border border-green/20 hover:bg-green/10 transition-all flex items-center gap-2"
                                            >
                                                {markingId === (group.group_id + s.from_user + s.to_user) ? '...' : 'Mark Paid'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="mt-12 p-6 bg-accent/5 border border-dashed border-accent/20 rounded-[24px] text-center">
                <p className="text-xs text-text-secondary leading-relaxed max-w-2xl mx-auto">
                    This global view provides a birds-eye perspective of your simplified debt plan. 
                    Recording a payment here will update the specific group's ledger and notify the recipient.
                </p>
            </div>
        </div>
    );
}
