import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
    {
        section: 'Main', items: [
            { to: '/', icon: '🏠', label: 'Dashboard' },
            { to: '/groups', icon: '👥', label: 'Groups' },
            { to: '/expenses', icon: '🧾', label: 'Expenses' },
            { to: '/settlements', icon: '💸', label: 'Settlements' },
        ]
    }
];

export default function Sidebar() {
    const location = useLocation();
    const { user, signOut } = useAuth();
    const [showLogout, setShowLogout] = useState(false);
    
    const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
    const init = displayName.substring(0, 2).toUpperCase();

    const handleLogout = async () => {
        if (window.confirm("Are you sure you want to sign out of SplitIt?")) {
            await signOut();
        }
    };

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
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </div>
                ))}
            </nav>

            {/* User Profile */}
            <div className="p-4 border-t border-border relative">
                {showLogout && (
                    <div className="absolute bottom-full left-4 right-4 mb-2 bg-bg-card border border-border rounded-[12px] shadow-2xl animate-fade-in z-50 overflow-hidden">
                        <button 
                            onClick={handleLogout}
                            className="w-full px-4 py-3 text-left text-sm font-semibold text-red hover:bg-red/5 transition-colors flex items-center gap-2"
                        >
                            <span>🚪</span> Sign Out
                        </button>
                    </div>
                )}
                
                <div 
                    onClick={() => setShowLogout(!showLogout)}
                    className={`flex items-center gap-3 p-2.5 rounded-[10px] cursor-pointer transition ${showLogout ? 'bg-white/10' : 'hover:bg-white/5'}`}
                >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-[#a78bfa] flex items-center justify-center text-xs font-bold text-white shrink-0">{init}</div>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{displayName}</div>
                        <div className="text-xs text-text-muted">Personal Workspace</div>
                    </div>
                    <span className={`text-text-muted text-sm transition-transform duration-300 ${showLogout ? 'rotate-90 text-text-primary' : ''}`}>⚙</span>
                </div>
            </div>
        </aside>
    );
}
