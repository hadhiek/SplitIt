export const EXPENSES = [
    { id: 1, desc: 'Hotel The Leela', group: '🏖 Goa Trip', paidBy: 'Priya', amount: 9200, share: 1150, status: 'approved', cat: '🏨', date: '2026-03-28' },
    { id: 2, desc: 'Dinner at Spice Garden', group: '🏖 Goa Trip', paidBy: 'Rohan', amount: 4800, share: 600, status: 'approved', cat: '🍽️', date: '2026-03-27' },
    { id: 3, desc: 'Cab Airport–Hotel', group: '🏖 Goa Trip', paidBy: 'Anita', amount: 1800, share: 225, status: 'pending', cat: '🚗', date: '2026-03-26' },
    { id: 4, desc: 'Water Sports', group: '🏖 Goa Trip', paidBy: 'Ketan', amount: 6400, share: 800, status: 'approved', cat: '🎉', date: '2026-03-25' },
    { id: 5, desc: 'Groceries Week 1', group: '🏠 Flat Expenses', paidBy: 'Priya', amount: 3200, share: 800, status: 'approved', cat: '🛒', date: '2026-03-20' },
    { id: 6, desc: 'Netflix Subscription', group: '🏠 Flat Expenses', paidBy: 'Mahesh', amount: 649, share: 162, status: 'pending', cat: '🎉', date: '2026-03-18' },
    { id: 7, desc: 'Pizza Friday', group: '🍕 Office Lunch', paidBy: 'Priya', amount: 2800, share: 350, status: 'approved', cat: '🍽️', date: '2026-03-15' },
    { id: 8, desc: 'Bus Passes', group: '🎓 College Friends', paidBy: 'Sneha', amount: 1200, share: 300, status: 'rejected', cat: '🚗', date: '2026-03-10' },
];

export const GROUPS = [
    { id: 1, emoji: '🏖', name: 'Goa Trip 2026', desc: '5-day trip to North Goa', members: 8, balance: 3360, status: 'active', color: '#6366f1' },
    { id: 2, emoji: '🏠', name: 'Flat Expenses', desc: 'Monthly shared costs', members: 4, balance: -840, status: 'active', color: '#22c55e' },
    { id: 3, emoji: '🍕', name: 'Office Lunch', desc: 'Work team food fund', members: 12, balance: 240, status: 'active', color: '#f59e0b' },
    { id: 4, emoji: '🎓', name: 'College Friends', desc: 'Reunion & hangouts', members: 6, balance: -320, status: 'active', color: '#3b82f6' },
    { id: 5, emoji: '💼', name: 'Client Project X', desc: 'Shared project costs', members: 3, balance: 0, status: 'settled', color: '#10b981' },
    { id: 6, emoji: '🎉', name: 'Birthday Party', desc: "Rahul's 30th birthday", members: 15, balance: 180, status: 'active', color: '#ec4899' },
];

export const VERIFY_EXPENSES = [
    { id: 'v1', desc: 'Hotel Booking', submittedBy: 'Rohan Kumar', group: 'Goa Trip', amount: 9200, receipt: '🏨', date: '2026-03-28', note: 'Booked via MakeMyTrip' },
    { id: 'v2', desc: 'Team Dinner', submittedBy: 'Anita Desai', group: 'Office Lunch', amount: 4600, receipt: '🍽️', date: '2026-03-27', note: 'Receipt attached' },
    { id: 'v3', desc: 'Fuel Expenses', submittedBy: 'Ketan Shah', group: 'Goa Trip', amount: 2400, receipt: '⛽', date: '2026-03-26', note: 'Shared fuel for road trip' },
    { id: 'v4', desc: 'Groceries March', submittedBy: 'Sneha Patel', group: 'Flat Expenses', amount: 3800, receipt: '🛒', date: '2026-03-25', note: 'Monthly groceries' },
    { id: 'v5', desc: 'Concert Tickets', submittedBy: 'Mahesh Nair', group: 'College Friends', amount: 5600, receipt: '🎵', date: '2026-03-22', note: '4 tickets × ₹1400' },
];

export const SETTLEMENTS = [
    { id: 's1', from: 'Rohan', to: 'Priya', amount: 1840, via: 'UPI', fromColor: '#6366f1', toColor: '#22c55e' },
    { id: 's2', from: 'Anita', to: 'Priya', amount: 720, via: 'Bank Transfer', fromColor: '#3b82f6', toColor: '#22c55e' },
    { id: 's3', from: 'Priya', to: 'Ketan', amount: 560, via: 'UPI', fromColor: '#ec4899', toColor: '#f59e0b' },
    { id: 's4', from: 'Sneha', to: 'Rohan', amount: 940, via: 'UPI', fromColor: '#10b981', toColor: '#6366f1' },
    { id: 's5', from: 'Mahesh', to: 'Anita', amount: 1200, via: 'Cash', fromColor: '#8b5cf6', toColor: '#3b82f6' },
];

export const PARTICIPANTS = [
    { name: 'Priya Sharma (You)', initials: 'PS', color: '#6366f1', selected: true },
    { name: 'Rohan Kumar', initials: 'RK', color: '#22c55e', selected: true },
    { name: 'Anita Desai', initials: 'AD', color: '#3b82f6', selected: false },
    { name: 'Ketan Shah', initials: 'KS', color: '#f59e0b', selected: true },
    { name: 'Sneha Patel', initials: 'SP', color: '#ec4899', selected: false },
    { name: 'Mahesh Nair', initials: 'MN', color: '#10b981', selected: true },
];

export const WALLET_TRANSACTIONS = [
    { icon: '📥', name: 'From Rohan Kumar', type: 'credit', date: 'Today, 3:42 PM', amount: 1840 },
    { icon: '📤', name: 'To Ketan Shah', type: 'debit', date: 'Yesterday, 11:20 AM', amount: -560 },
    { icon: '📥', name: 'Settled: Goa Trip', type: 'credit', date: 'Mar 28, 9:15 AM', amount: 3360 },
    { icon: '📤', name: 'Added Expense: Hotel', type: 'debit', date: 'Mar 27, 8:30 PM', amount: -9200 },
    { icon: '📥', name: 'From Sneha Patel', type: 'credit', date: 'Mar 26, 5:00 PM', amount: 940 },
    { icon: '💳', name: 'Wallet Top-up', type: 'credit', date: 'Mar 25, 12:00 PM', amount: 5000 },
];

export const PIE_DATA = [
    { label: 'Accommodation', amount: 7200, pct: 38, color: '#6366f1' },
    { label: 'Food & Dining', amount: 4840, pct: 26, color: '#22c55e' },
    { label: 'Transport', amount: 3200, pct: 17, color: '#f59e0b' },
    { label: 'Entertainment', amount: 2400, pct: 13, color: '#3b82f6' },
    { label: 'Other', amount: 1000, pct: 6, color: '#ec4899' },
];

export const BAR_DATA = [
    { label: 'Oct', value: 8400 },
    { label: 'Nov', value: 12200 },
    { label: 'Dec', value: 21600 },
    { label: 'Jan', value: 9800 },
    { label: 'Feb', value: 14400 },
    { label: 'Mar', value: 18640 },
];

export const GD_EXPENSES = [
    { desc: 'Hotel The Leela', paidBy: 'Priya', amount: 9200, share: 1150, status: 'approved', date: 'Mar 28' },
    { desc: 'Dinner Spice Garden', paidBy: 'Rohan', amount: 4800, share: 600, status: 'approved', date: 'Mar 27' },
    { desc: 'Cab Airport', paidBy: 'Anita', amount: 1800, share: 225, status: 'pending', date: 'Mar 26' },
    { desc: 'Water Sports', paidBy: 'Ketan', amount: 6400, share: 800, status: 'approved', date: 'Mar 25' },
    { desc: 'Breakfast Day 2', paidBy: 'Priya', amount: 2400, share: 300, status: 'approved', date: 'Mar 25' },
    { desc: 'North Goa Cruise', paidBy: 'Sneha', amount: 3800, share: 475, status: 'pending', date: 'Mar 24' },
];

export const GD_MEMBERS = [
    { name: 'Priya Sharma', email: 'priya@gmail.com', role: 'Admin', color: '#6366f1', balance: 3360, initials: 'PS' },
    { name: 'Rohan Kumar', email: 'rohan@gmail.com', role: 'Member', color: '#22c55e', balance: -1840, initials: 'RK' },
    { name: 'Anita Desai', email: 'anita@gmail.com', role: 'Co-admin', color: '#3b82f6', balance: -720, initials: 'AD' },
    { name: 'Ketan Shah', email: 'ketan@gmail.com', role: 'Member', color: '#f59e0b', balance: 200, initials: 'KS' },
    { name: 'Sneha Patel', email: 'sneha@gmail.com', role: 'Member', color: '#ec4899', balance: -480, initials: 'SP' },
    { name: 'Mahesh Nair', email: 'mahesh@gmail.com', role: 'Member', color: '#10b981', balance: 320, initials: 'MN' },
    { name: 'Divya R.', email: 'divya@gmail.com', role: 'Member', color: '#8b5cf6', balance: -160, initials: 'DR' },
    { name: 'Amit L.', email: 'amit@gmail.com', role: 'Member', color: '#06b6d4', balance: -680, initials: 'AL' },
];

export function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
