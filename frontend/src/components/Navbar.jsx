import { useLocation } from 'react-router-dom';
import { useToast } from './ToastProvider';

const pageTitles = {
    '/': 'Dashboard',
    '/groups': 'Groups',
    '/expenses': 'All Expenses',
    '/add-expense': 'Add Expense',
    '/settlements': 'Settlements',
    '/wallet': 'Wallet',
    '/analytics': 'Analytics',
    '/verification': 'Expense Verification',
};

export default function Navbar() {
    const location = useLocation();
    const showToast = useToast();

    const title = pageTitles[location.pathname] || (location.pathname.startsWith('/groups/') ? 'Group Detail' : 'SplitIt');

    return (
        <header className="fixed top-0 left-60 right-0 h-16 bg-bg-primary/80 backdrop-blur-xl border-b border-border flex items-center justify-between px-8 z-50">
            <div className="flex items-center gap-4">
                <h2 className="text-[1.1rem] font-semibold">{title}</h2>
            </div>
            <div className="flex items-center gap-3">
                {/* Search */}
                <div className="flex items-center gap-2.5 bg-bg-input border border-border rounded-full px-4 py-2 w-60 focus-within:border-accent focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.15)] transition">
                    <span className="text-text-muted text-sm">🔍</span>
                    <input type="text" placeholder="Search expenses, groups..." className="bg-transparent border-none outline-none text-text-primary text-sm w-full placeholder:text-text-muted" />
                </div>
                {/* Notifications */}
                <button
                    onClick={() => showToast('info', 'Notifications', 'You have 3 new expense requests and 2 settlement reminders')}
                    className="w-[38px] h-[38px] rounded-[10px] bg-bg-card border border-border flex items-center justify-center text-text-secondary text-base hover:bg-bg-card-hover hover:text-text-primary transition relative"
                >
                    🔔
                    <span className="absolute top-1.5 right-1.5 w-[7px] h-[7px] bg-red rounded-full border-[1.5px] border-bg-primary" />
                </button>
            </div>
        </header>
    );
}
