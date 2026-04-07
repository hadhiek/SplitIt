import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { StatusBadge } from '../components/ui';
import { useToast } from '../components/ToastProvider';

export default function ExpensesPage() {
    const { user } = useAuth();
    const [expenses, setExpenses] = useState([]);
    const [groupsMap, setGroupsMap] = useState({});
    const [loading, setLoading] = useState(true);
    
    const [groupFilter, setGroupFilter] = useState('All Groups');
    const [statusFilter, setStatusFilter] = useState('All Status');
    const showToast = useToast();

    useEffect(() => {
        async function fetchData() {
            try {
                const [expRes, gridRes] = await Promise.all([
                    api.get('/api/expenses'),
                    api.get('/api/groups')
                ]);
                setExpenses(expRes.data);
                
                const gMap = {};
                gridRes.data.forEach(g => {
                    gMap[g.id] = g;
                });
                setGroupsMap(gMap);
            } catch (err) {
                console.error("Failed to fetch expenses", err);
                showToast('error', 'Error', 'Failed to load expenses');
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [showToast]);

    const groupOptions = ['All Groups', ...Object.values(groupsMap).map(g => g.name)];
    const statusOptions = ['All Status', 'approved', 'pending', 'rejected'];

    const filtered = expenses.filter(e => {
        const group = groupsMap[e.group_id];
        const groupName = group?.name || 'Unknown Group';
        if (groupFilter !== 'All Groups' && groupName !== groupFilter) return false;
        if (statusFilter !== 'All Status' && e.status !== statusFilter) return false;
        return true;
    });

    if (loading) return <div className="p-8 text-text-muted">Loading expenses...</div>;

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-7">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">All Expenses</h1>
                    <p className="text-text-secondary text-sm mt-1">Tracking {expenses.length} expenses this month</p>
                </div>
                <Link to="/add-expense" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-sm font-semibold bg-accent text-white hover:bg-[#5254cc] transition">+ Add Expense</Link>
            </div>

            {/* Filters */}
            <div className="flex gap-3 mb-5 flex-wrap">
                <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} className="bg-bg-input border border-border text-text-primary px-4 py-3 rounded-[10px] text-[0.95rem] outline-none focus:border-accent transition cursor-pointer appearance-none min-w-[140px]">
                    {groupOptions.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-bg-input border border-border text-text-primary px-4 py-3 rounded-[10px] text-[0.95rem] outline-none focus:border-accent transition cursor-pointer appearance-none min-w-[140px]">
                    {statusOptions.map(o => <option key={o} value={o} className="capitalize">{o}</option>)}
                </select>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-[14px] bg-bg-card border border-border">
                {filtered.length === 0 && <div className="p-8 text-center text-text-muted">No expenses found matching the criteria.</div>}
                {filtered.length > 0 && (
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                {['Description', 'Group', 'Paid By', 'Total', 'Your Share', 'Status', 'Date', ''].map(h => (
                                    <th key={h} className="text-xs font-semibold text-text-muted uppercase tracking-wide px-5 py-3.5 text-left border-b border-border">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(e => {
                                const mySplit = e.splits?.find(s => s.user_id === user?.id);
                                const myShare = mySplit ? mySplit.amount_owed : 0;
                                const iPaid = e.paid_by === user?.id;
                                
                                return (
                                <tr key={e.id} className="border-b border-border last:border-b-0 hover:bg-white/[0.02] transition">
                                    <td className="px-5 py-3.5 text-sm">
                                        <div className="flex items-center gap-2.5">
                                            <span className="text-lg">{e.category === 'Food & Dining' ? <img src="../../logo/pizza.png"/> : e.category === 'Transport' ? <img src="../../logo/transportation.png"/> : e.category === 'Health' ? <img src="../../logo/health.png"/>: e.category === 'Accomodation' ? <img src="../../logo/accomodation.png"/>: e.category === 'Entertainment' ? <img src="../../logo/entertainment.png"/>: e.category === 'Shopping' ? <img src="../../logo/shopping.png"/>: e.category === 'Bill' ? <img src="../../logo/bill.png"/> : <img src="../../logo/box.png"/>}</span>
                                            <strong>{e.description}</strong>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3.5 text-sm text-text-secondary">{groupsMap[e.group_id]?.name || 'Unknown'}</td>
                                    <td className="px-5 py-3.5 text-sm text-text-secondary">{iPaid ? 'You' : 'Someone'}</td>
                                    <td className="px-5 py-3.5 text-sm font-bold">₹{e.amount?.toLocaleString()}</td>
                                    <td className={`px-5 py-3.5 text-sm ${iPaid ? 'text-green font-bold' : 'text-red font-bold'}`}>
                                        ₹{myShare?.toLocaleString()}
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <StatusBadge status={(groupsMap[e.group_id] && Math.abs(groupsMap[e.group_id].user_balance || 0) < 0.05) ? 'settled' : (e.status || 'pending')} />
                                    </td>
                                    <td className="px-5 py-3.5 text-sm text-text-muted">
                                        {new Date(e.expense_date || e.created_at).toLocaleDateString('en-IN')}
                                    </td>
                                    <td className="px-5 py-3.5"><button onClick={() => showToast('info', 'Expense', 'Details view coming soon!')} className="text-text-secondary hover:bg-white/5 px-3 py-1 rounded-md transition text-xs">···</button></td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
