import { EXPENSES, PIE_DATA, BAR_DATA, formatDate } from '../data/mockData';

function PieChart() {
    const cx = 80, cy = 80, r = 70;
    let startAngle = -Math.PI / 2;
    const paths = [];

    PIE_DATA.forEach(item => {
        const angle = (item.pct / 100) * 2 * Math.PI;
        const endAngle = startAngle + angle;
        const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle);
        const largeArc = angle > Math.PI ? 1 : 0;
        paths.push(
            <path key={item.label}
                d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                fill={item.color} opacity="0.9" stroke="var(--color-bg-primary)" strokeWidth="2"
                className="cursor-pointer hover:opacity-100 transition-opacity"
            >
                <title>{item.label}: ₹{item.amount.toLocaleString()} ({item.pct}%)</title>
            </path>
        );
        startAngle = endAngle;
    });

    return (
        <div className="flex items-center gap-8">
            <svg width="160" height="160" viewBox="0 0 160 160">
                {paths}
                <circle cx={cx} cy={cy} r="40" fill="var(--color-bg-card)" />
                <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--color-text-primary)" fontSize="14" fontWeight="800" fontFamily="Inter">₹18.6K</text>
                <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--color-text-muted)" fontSize="9" fontFamily="Inter">TOTAL</text>
            </svg>
            <div className="flex flex-col gap-3">
                {PIE_DATA.map(item => (
                    <div key={item.label} className="flex items-center gap-2.5 text-sm">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ background: item.color }} />
                        <span className="text-text-secondary min-w-[100px]">{item.label}</span>
                        <span className="font-semibold">₹{(item.amount / 1000).toFixed(1)}K</span>
                        <span className="text-text-muted text-xs">{item.pct}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function BarChart() {
    const maxVal = Math.max(...BAR_DATA.map(d => d.value));
    const colors = ['#6366f1', '#818cf8', '#6366f1', '#818cf8', '#6366f1', '#a78bfa'];

    return (
        <div className="flex items-end gap-4 h-52 mt-4 px-4">
            {BAR_DATA.map((d, i) => {
                const heightPct = (d.value / maxVal) * 100;
                return (
                    <div key={d.label} className="flex flex-col items-center flex-1 gap-2 group">
                        <div
                            className="w-full rounded-t-[6px] relative transition-all duration-700 cursor-pointer group-hover:opacity-90"
                            style={{ height: `${heightPct}%`, background: `linear-gradient(180deg, ${colors[i]}, ${colors[i]}88)`, animationDelay: `${i * 0.1}s` }}
                        >
                            <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-bg-card text-text-primary text-xs font-bold px-2.5 py-1 rounded-md border border-border shadow-lg transition whitespace-nowrap">
                                ₹{(d.value / 1000).toFixed(1)}K
                            </div>
                        </div>
                        <span className="text-xs text-text-muted">{d.label}</span>
                    </div>
                );
            })}
        </div>
    );
}

export default function AnalyticsPage() {
    const top = [...EXPENSES].sort((a, b) => b.amount - a.amount).slice(0, 5);

    return (
        <div className="animate-fade-in">
            <div className="mb-7">
                <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
                <p className="text-text-secondary text-sm mt-1">Spending insights and trends</p>
            </div>

            <div className="grid grid-cols-2 gap-5 mb-8">
                {/* Pie */}
                <div className="bg-bg-card border border-border rounded-[20px] p-6">
                    <div className="text-[0.95rem] font-semibold mb-5">Spending by Category</div>
                    <PieChart />
                </div>
                {/* Bar */}
                <div className="bg-bg-card border border-border rounded-[20px] p-6 overflow-hidden">
                    <div className="text-[0.95rem] font-semibold mb-2">Monthly Trends</div>
                    <div className="text-xs text-text-muted mb-4">Last 6 months</div>
                    <BarChart />
                </div>
            </div>

            {/* Top Expenses Table */}
            <div className="bg-bg-card border border-border rounded-[20px] overflow-hidden">
                <div className="px-6 pt-5 pb-3 text-[0.95rem] font-semibold">Top Expenses</div>
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            {['Description', 'Category', 'Group', 'Amount', 'Your Share', 'Date'].map(h => (
                                <th key={h} className="text-xs font-semibold text-text-muted uppercase tracking-wide px-5 py-3 text-left border-b border-border">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {top.map(e => (
                            <tr key={e.id} className="border-b border-border last:border-b-0 hover:bg-white/[0.02] transition">
                                <td className="px-5 py-3.5 text-sm"><div className="flex items-center gap-2"><span>{e.cat}</span><strong>{e.desc}</strong></div></td>
                                <td className="px-5 py-3.5"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs bg-[rgba(148,163,184,0.1)] text-text-secondary">{e.cat}</span></td>
                                <td className="px-5 py-3.5 text-sm text-text-secondary">{e.group}</td>
                                <td className="px-5 py-3.5 text-sm font-bold">₹{e.amount.toLocaleString()}</td>
                                <td className={`px-5 py-3.5 text-sm ${e.paidBy === 'Priya' ? 'text-green font-bold' : 'text-red font-bold'}`}>₹{e.share}</td>
                                <td className="px-5 py-3.5 text-sm text-text-muted">{formatDate(e.date)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
