import { NavLink, useLocation } from 'react-router-dom';

const navItems = [
    {
        section: 'Main', items: [
            { to: '/', icon: '🏠', label: 'Dashboard' },
            { to: '/groups', icon: '👥', label: 'Groups' },
            { to: '/expenses', icon: '🧾', label: 'Expenses', badge: 3 },
            { to: '/settlements', icon: '⚡', label: 'Settlements' },
        ]
    },
    {
        section: 'Finance', items: [
            { to: '/wallet', icon: '💳', label: 'Wallet' },
            { to: '/analytics', icon: '📊', label: 'Analytics' },
        ]
    },
    {
        section: 'Admin', items: [
            { to: '/verification', icon: '✅', label: 'Verify Expenses', badge: 5 },
        ]
    },
];

export default function Sidebar() {
    const location = useLocation();

    return (
        <aside className="w-60 bg-bg-sidebar border-r border-border fixed top-0 left-0 bottom-0 flex flex-col z-[100]">
            {/* Logo */}
            <div className="px-5 py-4 pb-3.5 border-b border-border flex items-center gap-2.5">
                <div className="w-8 h-8 bg-gradient-to-br from-accent to-accent-light rounded-[10px] flex items-center justify-center text-base">✂</div>
                <span className="text-xl font-extrabold tracking-tight">SplitIt</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 overflow-y-auto">
                {navItems.map(section => (
                    <div key={section.section}>
                        <div className="text-[0.7rem] font-semibold tracking-widest uppercase text-text-muted px-2 mt-4 mb-2 first:mt-0">
                            {section.section}
                        </div>
                        {section.items.map(item => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to === '/'}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium mb-0.5 transition-all relative ${isActive ? 'bg-accent-dim text-accent-light' : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'}`
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-accent rounded-full" />}
                                        <span className="w-5 text-center text-[17px]">{item.icon}</span>
                                        <span>{item.label}</span>
                                        {item.badge && (
                                            <span className="ml-auto bg-red text-white text-[0.7rem] font-bold px-[7px] py-0.5 rounded-full">
                                                {item.badge}
                                            </span>
                                        )}
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </div>
                ))}
            </nav>

            {/* User Profile */}
            <div className="p-4 border-t border-border">
                <div className="flex items-center gap-3 p-2.5 rounded-[10px] cursor-pointer hover:bg-white/5 transition">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-[#a78bfa] flex items-center justify-center text-xs font-bold text-white shrink-0">PS</div>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">Priya Sharma</div>
                        <div className="text-xs text-yellow">Admin</div>
                    </div>
                    <span className="text-text-muted text-sm">⚙</span>
                </div>
            </div>
        </aside>
    );
}
