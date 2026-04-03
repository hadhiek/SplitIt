import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EXPENSES, formatDate } from '../data/mockData';
import { StatusBadge } from '../components/ui';
import { useToast } from '../components/ToastProvider';

export default function ExpensesPage() {
    const [groupFilter, setGroupFilter] = useState('All Groups');
    const [statusFilter, setStatusFilter] = useState('All Status');
    const showToast = useToast();

    const filtered = EXPENSES.filter(e => {
        if (groupFilter !== 'All Groups' && !e.group.includes(groupFilter)) return false;
        if (statusFilter !== 'All Status' && e.status !== statusFilter.toLowerCase()) return false;
        return true;
    });

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-7">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">All Expenses</h1>
                    <p className="text-text-secondary text-sm mt-1">Tracking {EXPENSES.length} expenses this month</p>
                </div>
                <Link to="/add-expense" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-sm font-semibold bg-accent text-white hover:bg-[#5254cc] transition">+ Add Expense</Link>
            </div>

            {/* Filters */}
            <div className="flex gap-3 mb-5 flex-wrap">
                {[{ val: groupFilter, set: setGroupFilter, opts: ['All Groups', 'Goa Trip', 'Flat Expenses', 'Office Lunch'] },
                { val: statusFilter, set: setStatusFilter, opts: ['All Status', 'Approved', 'Pending', 'Rejected'] }
                ].map((f, i) => (
                    <select key={i} value={f.val} onChange={e => f.set(e.target.value)} className="bg-bg-input border border-border text-text-primary px-4 py-3 rounded-[10px] text-[0.95rem] outline-none focus:border-accent transition cursor-pointer appearance-none min-w-[140px]">
                        {f.opts.map(o => <option key={o}>{o}</option>)}
                    </select>
                ))}
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-[14px] bg-bg-card border border-border">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            {['Description', 'Group', 'Paid By', 'Total', 'Your Share', 'Status', 'Date', ''].map(h => (
                                <th key={h} className="text-xs font-semibold text-text-muted uppercase tracking-wide px-5 py-3.5 text-left border-b border-border">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(e => (
                            <tr key={e.id} className="border-b border-border last:border-b-0 hover:bg-white/[0.02] transition">
                                <td className="px-5 py-3.5 text-sm">
                                    <div className="flex items-center gap-2.5"><span className="text-lg">{e.cat}</span><strong>{e.desc}</strong></div>
                                </td>
                                <td className="px-5 py-3.5 text-sm text-text-secondary">{e.group}</td>
                                <td className="px-5 py-3.5 text-sm text-text-secondary">{e.paidBy}</td>
                                <td className="px-5 py-3.5 text-sm font-bold">₹{e.amount.toLocaleString()}</td>
                                <td className={`px-5 py-3.5 text-sm ${e.paidBy === 'Priya' ? 'text-green font-bold' : 'text-red font-bold'}`}>₹{e.share}</td>
                                <td className="px-5 py-3.5"><StatusBadge status={e.status} /></td>
                                <td className="px-5 py-3.5 text-sm text-text-muted">{formatDate(e.date)}</td>
                                <td className="px-5 py-3.5"><button onClick={() => showToast('info', 'Expense', 'Details view coming soon!')} className="text-text-secondary hover:bg-white/5 px-3 py-1 rounded-md transition text-xs">···</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
