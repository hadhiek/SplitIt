import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { SummaryCard, Avatar } from '../components/ui';
import { useToast } from '../components/ToastProvider';

export default function SettlementsPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const showToast = useToast();
    
    const [loading, setLoading] = useState(true);
    const [group, setGroup] = useState(null);
    const [optimizedSettlements, setOptimizedSettlements] = useState([]);
    const [markingId, setMarkingId] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [groupRes, optRes] = await Promise.all([
                api.get(`/api/groups/${id}`),
                api.get(`/api/settlements/optimize/${id}`)
            ]);
            setGroup(groupRes.data);
            setOptimizedSettlements(optRes.data);
        } catch (err) {
            console.error(err);
            showToast('error', 'Error', 'Failed to load settlement data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [id]);

    const handleMarkPaid = async (s) => {
        setMarkingId(s.from_user + s.to_user);
        try {
            await api.post('/api/settlements', {
                group_id: parseInt(id),
                to_user: s.to_user,
                amount: s.amount,
                payment_method: 'cash'
            });
            showToast('success', 'Paid!', `Recorded ₹${s.amount} from ${s.from_user_name} to ${s.to_user_name}`);
            // Refresh optimization
            fetchData();
        } catch (err) {
            showToast('error', 'Error', err.response?.data?.detail || 'Failed to record payment');
        } finally {
            setMarkingId(null);
        }
    };

    if (loading && !group) return <div className="p-8 text-text-muted">Loading optimization plan...</div>;

    // Derive people for the graph
    const uniquePeople = [];
    const seen = new Set();
    optimizedSettlements.forEach(s => {
        if (!seen.has(s.from_user)) {
            uniquePeople.push({ id: s.from_user, name: s.from_user_name });
            seen.add(s.from_user);
        }
        if (!seen.has(s.to_user)) {
            uniquePeople.push({ id: s.to_user, name: s.to_user_name });
            seen.add(s.to_user);
        }
    });

    const totalToSettle = optimizedSettlements.reduce((sum, s) => sum + s.amount, 0);

    return (
        <div className="animate-fade-in pb-20">
            <div className="flex items-center gap-4 mb-7">
                <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-white/5 transition">←</button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Settlements: {group?.name}</h1>
                    <p className="text-text-secondary text-sm mt-0.5">Optimized debt simplification plan</p>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-5 mb-8">
                <SummaryCard icon="../../logo/accomodation.png" iconBg="rgba(99,102,241,0.15)" label="Total Group Debt" value={`₹${totalToSettle}`} colorClass="purple" change={{ text: 'To be cleared' }} />
                <SummaryCard icon="../../logo/custom.png" iconBg="rgba(245,158,11,0.12)" label="Required Transfers" value={optimizedSettlements.length} colorClass="yellow" change={{ text: 'Simplified' }} />
                <SummaryCard icon="../../logo/group.png" iconBg="rgba(34,197,94,0.12)" label="Active Members" value={group?.members?.length || 0} colorClass="green" change={{ text: 'Participants' }} />
            </div>

            {/* Flow Graph - Real Data */}
            {optimizedSettlements.length > 0 && (
                <div className="bg-bg-card border border-border rounded-[24px] p-8 mb-8 shadow-xl shadow-black/20">
                    <div className="text-[0.95rem] font-bold mb-6 text-text-primary uppercase tracking-widest px-1">Optimized Payment Flow</div>
                    
                    <div className="flex flex-wrap gap-6 items-center justify-center w-full mb-8 py-4 px-6 border border-dashed border-border/50 rounded-[20px] bg-white/[0.01]">
                        {uniquePeople.map((p, idx) => (
                            <div key={p.id} className="flex flex-col items-center gap-3">
                                <Avatar initials={p.name.substring(0,2).toUpperCase()} color={['#6366f1', '#22c55e', '#3b82f6', '#f59e0b', '#ec4899'][idx % 5]} size={56} />
                                <span className="text-[0.7rem] font-bold uppercase tracking-wider text-text-secondary">{p.name}</span>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-wrap gap-4 justify-center">
                        {optimizedSettlements.map((s, i) => (
                            <div key={i} className="flex items-center gap-2.5 bg-accent/5 border border-accent/10 rounded-full px-5 py-2.5 text-xs animate-scale-in">
                                <span className="font-bold text-text-primary">{s.from_user_name}</span>
                                <span className="text-accent-light px-1 font-black">→</span>
                                <span className="font-bold text-text-primary">{s.to_user_name}</span>
                                <span className="ml-2 bg-accent/20 px-3 py-1 rounded-full text-accent font-black">₹{s.amount}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Settlement List */}
            <div className="space-y-4">
                <div className="text-[0.8rem] font-bold uppercase tracking-[0.2em] text-text-muted px-2">Proposed Transactions</div>
                
                {optimizedSettlements.length === 0 ? (
                    <div className="bg-bg-card border border-border rounded-[20px] p-12 text-center">
                        <div className="text-4xl mb-4"><img src="../../logo/trophy.png" /></div>
                        <div className="text-lg font-bold">Everyone is settled!</div>
                        <p className="text-sm text-text-muted mt-1">No debts outstanding in this group.</p>
                    </div>
                ) : (
                    optimizedSettlements.map((s, idx) => (
                        <div key={idx} className="flex items-center gap-5 p-5 bg-bg-card border border-border rounded-[20px] hover:border-accent/30 hover:scale-[1.01] transition-all duration-300">
                            <div className="flex -space-x-3">
                                <Avatar initials={s.from_user_name.substring(0,2).toUpperCase()} color="#6366f1" size={44} />
                                <Avatar initials={s.to_user_name.substring(0,2).toUpperCase()} color="#3b82f6" size={44} />
                            </div>
                            
                            <div className="flex-1">
                                <div className="text-[0.95rem] font-bold text-text-primary">
                                    {s.from_user_name} <span className="text-text-muted font-normal mx-1">should pay</span> {s.to_user_name}
                                </div>
                                <div className="text-[0.7rem] font-bold text-text-muted mt-1 uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" /> Simplified Debt
                                </div>
                            </div>
                            
                            <div className="text-xl font-black text-accent mr-2">₹{s.amount}</div>
                            
                            <div className="flex gap-2">
                                <button 
                                    disabled={markingId === (s.from_user + s.to_user)}
                                    onClick={() => handleMarkPaid(s)} 
                                    className="px-5 py-2.5 rounded-[12px] text-xs font-bold bg-green-dim text-green border border-green/20 hover:bg-green/10 hover:border-green/40 transition-all flex items-center gap-2 shadow-lg shadow-green/5"
                                >
                                    {markingId === (s.from_user + s.to_user) ? 'Recording...' : 'Mark Settled'}
                                </button>
                                <button onClick={() => showToast('info', 'Reminder', `Payment reminder sent to ${s.from_user_name}!`)} className="px-4 py-2.5 rounded-[12px] text-xs font-bold text-text-secondary bg-transparent border border-border hover:bg-white/5 transition">Remind</button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="mt-10 bg-accent/5 border border-dashed border-accent/20 rounded-[20px] p-6 text-center">
                <p className="text-xs text-text-secondary leading-relaxed max-w-lg mx-auto">
                    Algorithms minimize the number of transfers needed to square everyone up. 
                    Recording a payment here will update the group balance and notify the receiver.
                </p>
            </div>
        </div>
    );
}
