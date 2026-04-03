import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { GROUPS, GD_EXPENSES, GD_MEMBERS, SETTLEMENTS } from '../data/mockData';
import { StatusBadge, Badge, Avatar } from '../components/ui';
import { useToast } from '../components/ToastProvider';

export default function GroupDetailPage() {
    const { id } = useParams();
    const group = GROUPS.find(g => g.id === Number(id)) || GROUPS[0];
    const [activeTab, setActiveTab] = useState('expenses');
    const showToast = useToast();
    const tabs = ['expenses', 'members', 'settlements'];

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-7">
                <div className="flex items-center gap-3">
                    <Link to="/groups" className="inline-flex items-center px-2.5 py-2.5 rounded-[10px] text-text-secondary hover:bg-white/5 hover:text-text-primary transition">←</Link>
                    <div>
                        <h1 className="text-2xl font-bold">{group.emoji} {group.name}</h1>
                        <p className="text-text-secondary text-sm mt-1">{group.members} Members</p>
                    </div>
                </div>
                <div className="flex gap-2.5">
                    <button className="px-5 py-2.5 rounded-[10px] text-sm font-semibold bg-bg-card text-text-primary border border-border hover:bg-bg-card-hover transition">⚙ Settings</button>
                    <Link to="/add-expense" className="px-5 py-2.5 rounded-[10px] text-sm font-semibold bg-accent text-white hover:bg-[#5254cc] transition inline-flex items-center gap-2">+ Add Expense</Link>
                </div>
            </div>

            {/* Stats Row */}
            <div className="bg-bg-card border border-border rounded-[20px] px-6 py-5 mb-6">
                <div className="flex gap-6 items-center px-6">
                    {[
                        { label: 'Total Spent', value: '₹28,400' },
                        { label: 'You Paid', value: '₹9,200', cls: 'text-green' },
                        { label: 'Your Share', value: '₹5,840' },
                        { label: 'Balance', value: '+₹3,360', cls: 'text-green' },
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
                        <Badge color="green">Active</Badge>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-bg-card border border-border rounded-[14px] p-1 w-fit mb-7">
                {tabs.map(t => (
                    <button key={t} onClick={() => setActiveTab(t)} className={`px-5 py-2 rounded-[10px] text-sm font-semibold transition capitalize ${activeTab === t ? 'bg-accent text-white' : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'}`}>
                        {t === 'expenses' ? '📋' : t === 'members' ? '👥' : '⚡'} {t}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'expenses' && (
                <div className="overflow-x-auto rounded-[14px] bg-bg-card border border-border animate-fade-in">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                {['Description', 'Paid By', 'Amount', 'Your Share', 'Status', 'Date'].map(h => (
                                    <th key={h} className="text-xs font-semibold text-text-muted uppercase tracking-wide px-5 py-3.5 text-left border-b border-border">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {GD_EXPENSES.map((e, i) => (
                                <tr key={i} className="border-b border-border last:border-b-0 hover:bg-white/[0.02] transition">
                                    <td className="px-5 py-3.5 text-sm font-semibold">{e.desc}</td>
                                    <td className="px-5 py-3.5 text-sm text-text-secondary">{e.paidBy}</td>
                                    <td className="px-5 py-3.5 text-sm font-bold">₹{e.amount.toLocaleString()}</td>
                                    <td className={`px-5 py-3.5 text-sm ${e.paidBy === 'Priya' ? 'text-green font-bold' : 'text-red font-bold'}`}>₹{e.share}</td>
                                    <td className="px-5 py-3.5"><StatusBadge status={e.status} /></td>
                                    <td className="px-5 py-3.5 text-sm text-text-muted">{e.date}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'members' && (
                <div className="bg-bg-card border border-border rounded-[20px] p-6 animate-fade-in">
                    {GD_MEMBERS.map(m => (
                        <div key={m.email} className="flex items-center gap-3.5 py-3.5 border-b border-border last:border-b-0">
                            <Avatar initials={m.initials} color={m.color} />
                            <div className="flex-1">
                                <div className="text-sm font-semibold">{m.name} <Badge color={m.role === 'Admin' ? 'blue' : m.role === 'Co-admin' ? 'yellow' : 'gray'}>{m.role}</Badge></div>
                                <div className="text-xs text-text-muted mt-0.5">{m.email}</div>
                            </div>
                            <div className={`text-sm font-bold ${m.balance > 0 ? 'text-green' : m.balance < 0 ? 'text-red' : ''}`}>
                                {m.balance > 0 ? '+' : ''}₹{Math.abs(m.balance)}
                            </div>
                            <button onClick={() => showToast('info', 'Member', 'Manage member options coming soon!')} className="px-3.5 py-1.5 rounded-[10px] text-xs font-semibold text-text-secondary hover:bg-white/5 transition">···</button>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'settlements' && (
                <div className="flex flex-col gap-2.5 animate-fade-in">
                    {SETTLEMENTS.slice(0, 3).map(s => (
                        <div key={s.id} className="flex items-center gap-4 p-5 bg-bg-card border border-border rounded-[14px] hover:border-white/10 transition">
                            <Avatar initials={s.from.substring(0, 2)} color={s.fromColor} size={42} />
                            <div className="flex-1">
                                <div className="text-[0.95rem] font-semibold flex items-center gap-2"><span>{s.from}</span><span className="text-text-muted">→</span><span className="text-green">{s.to}</span></div>
                                <div className="text-xs text-text-muted mt-0.5">via {s.via}</div>
                            </div>
                            <div className="text-lg font-extrabold text-red">₹{s.amount.toLocaleString()}</div>
                            <button onClick={() => showToast('success', 'Paid!', `₹${s.amount} from ${s.from} to ${s.to} settled`)} className="px-3.5 py-1.5 rounded-[10px] text-xs font-semibold bg-green-dim text-green border border-[rgba(34,197,94,0.3)] hover:bg-[rgba(34,197,94,0.2)] transition">Mark Paid</button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
