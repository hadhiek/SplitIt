import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api';
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
    const [notifications, setNotifications] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef(null);

    const title = pageTitles[location.pathname] || (location.pathname.startsWith('/groups/') ? 'Group Detail' : 'SplitIt');

    useEffect(() => {
        // Fetch notifications
        const fetchNotifications = async () => {
            try {
                const res = await api.get('/api/notifications');
                setNotifications(res.data);
            } catch (err) {
                console.error("Failed to load notifications", err);
            }
        };
        fetchNotifications();
    }, [location.pathname]); // Refetch on route change occasionally

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;

    const handleMarkAsRead = async (id) => {
        try {
            await api.post(`/api/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        } catch (e) {
            console.error("Could not mark as read", e);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await api.post('/api/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            showToast('success', 'Cleared', 'All notifications marked as read.');
            setShowDropdown(false);
        } catch (e) {
            console.error("Could not mark all as read", e);
        }
    };

    return (
        <header className="fixed top-0 left-60 right-0 h-16 bg-bg-primary/80 backdrop-blur-xl border-b border-border flex items-center justify-between px-8 z-50">
            <div className="flex items-center gap-4">
                <h2 className="text-[1.1rem] font-semibold">{title}</h2>
            </div>
            <div className="flex items-center gap-3 relative">
                {/* Search */}
                <div className="flex items-center gap-2.5 bg-bg-input border border-border rounded-full px-4 py-2 w-60 focus-within:border-accent focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.15)] transition">
                    <span className="text-text-muted text-sm">🔍</span>
                    <input type="text" placeholder="Search expenses, groups..." className="bg-transparent border-none outline-none text-text-primary text-sm w-full placeholder:text-text-muted" />
                </div>
                
                {/* Notifications */}
                <div ref={dropdownRef}>
                    <button
                        onClick={() => setShowDropdown(!showDropdown)}
                        className={`w-[38px] h-[38px] rounded-[10px] border flex items-center justify-center text-base transition relative ${showDropdown ? 'bg-bg-card-hover border-border text-text-primary' : 'bg-bg-card border-border text-text-secondary hover:bg-bg-card-hover hover:text-text-primary'}`}
                    >
                        🔔
                        {unreadCount > 0 && (
                            <span className="absolute top-1.5 right-1.5 w-[8px] h-[8px] bg-red rounded-full border-[1.5px] border-bg-primary" />
                        )}
                    </button>

                    {/* Dropdown Panel */}
                    {showDropdown && (
                        <div className="absolute top-full right-0 mt-2 w-80 bg-bg-card border border-border rounded-[14px] shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden animate-fade-in z-[100]">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-primary/50">
                                <span className="text-sm font-semibold">Notifications</span>
                                {unreadCount > 0 && (
                                    <button onClick={handleMarkAllRead} className="text-xs text-accent-light hover:underline font-medium">Mark all as read</button>
                                )}
                            </div>
                            <div className="max-h-[350px] overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="text-center text-sm text-text-muted py-6">No notifications yet.</div>
                                ) : (
                                    notifications.map(n => (
                                        <div 
                                            key={n.id} 
                                            onClick={() => !n.read && handleMarkAsRead(n.id)}
                                            className={`p-4 border-b border-border last:border-b-0 cursor-pointer transition ${n.read ? 'opacity-60 hover:opacity-100 bg-transparent' : 'bg-[rgba(99,102,241,0.05)] hover:bg-[rgba(99,102,241,0.1)]'}`}
                                        >
                                            <div className="flex gap-3">
                                                <div className="text-lg shrink-0">
                                                    {n.type === 'success' ? '✅' : n.type === 'error' ? '❌' : '✉️'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className={`text-[0.9rem] leading-snug ${n.read ? 'text-text-secondary' : 'font-semibold text-text-primary'}`}>
                                                        {n.message}
                                                    </div>
                                                    <div className="text-[0.7rem] text-text-muted mt-1.5 font-medium uppercase tracking-wider">
                                                        {new Date(n.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                                {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
