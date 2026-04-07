export function SummaryCard({ icon, iconBg, label, value, change, colorClass = 'purple', valueClass = '' }) {
    const topColors = {
        green: 'from-green to-transparent',
        red: 'from-red to-transparent',
        yellow: 'from-yellow to-transparent',
        blue: 'from-blue to-transparent',
        purple: 'from-accent to-transparent',
    };

    return (
        <div className="bg-bg-card border border-border rounded-[20px] p-6 relative overflow-hidden hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.5)] transition-all group">
            <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${topColors[colorClass] || topColors.purple}`} />
            <div className={`w-11 h-11 rounded-[10px] flex items-center justify-center text-xl mb-4`} style={{ background: iconBg }}><img src={icon} /></div>
            <div className="text-xs text-text-muted font-medium uppercase tracking-wide mb-2">{label}</div>
            <div className={`text-[1.8rem] font-extrabold tracking-tight mb-2 ${valueClass}`}>{value}</div>
            {change && <div className={`text-xs flex items-center gap-1 ${change.up ? 'text-green' : change.down ? 'text-red' : 'text-text-muted'}`}>{change.text}</div>}
        </div>
    );
}

export function Badge({ color = 'gray', children }) {
    const styles = {
        green: 'bg-green-dim text-green before:bg-green',
        red: 'bg-red-dim text-red before:bg-red',
        yellow: 'bg-yellow-dim text-yellow before:bg-yellow',
        blue: 'bg-blue-dim text-blue before:bg-blue',
        gray: 'bg-[rgba(148,163,184,0.1)] text-text-secondary before:bg-text-secondary',
    };

    return (
        <span className={`inline-flex items-center gap-[5px] px-2.5 py-[3px] rounded-full text-xs font-semibold before:content-[''] before:w-[5px] before:h-[5px] before:rounded-full ${styles[color] || styles.gray}`}>
            {children}
        </span>
    );
}

export function StatusBadge({ status }) {
    const color = (status === 'approved' || status === 'settled') ? 'green' : status === 'pending' ? 'yellow' : 'red';
    return <Badge color={color}>{status}</Badge>;
}

export function AmountText({ amount, paidByUser = false }) {
    if (paidByUser) return <span className="text-green font-bold">you paid</span>;
    return <span className="text-red font-bold">you owe ₹{amount}</span>;
}

export function Avatar({ initials, color = '#6366f1', size = 36 }) {
    return (
        <div
            className="rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ width: size, height: size, background: color }}
        >
            {initials}
        </div>
    );
}

export function EmptyState({ icon, title, desc, action }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 px-10 text-center animate-fade-in">
            <div className="text-5xl mb-5 opacity-50">{icon}</div>
            <div className="text-lg font-bold mb-2">{title}</div>
            <div className="text-text-secondary text-sm max-w-[340px] leading-relaxed mb-7">{desc}</div>
            {action}
        </div>
    );
}
