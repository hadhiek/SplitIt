import { Link } from 'react-router-dom';

const features = [
    { icon: '💰', bg: 'rgba(99,102,241,0.15)', title: 'Smart Splitting', desc: 'Equal, percentage or custom splits. SplitIt figures out the math so you don\'t have to.' },
    { icon: '🧾', bg: 'rgba(34,197,94,0.15)', title: 'Receipt Verification', desc: 'Upload receipts for any expense. Admins verify before approval for full transparency.' },
    { icon: '📊', bg: 'rgba(59,130,246,0.15)', title: 'Analytics Dashboard', desc: 'Category-wise spending charts and time-based trends so you always know where money goes.' },
    { icon: '⚡', bg: 'rgba(245,158,11,0.15)', title: 'Instant Settlements', desc: 'Optimized payment graph reduces the number of transactions needed to settle up a group.' },
    { icon: '👥', bg: 'rgba(239,68,68,0.15)', title: 'Role Management', desc: 'Admins, co-admins and members each have the right level of access for secure collaboration.' },
    { icon: '🔔', bg: 'rgba(167,139,250,0.15)', title: 'Real-time Alerts', desc: 'Instant notifications when expenses are added, approved or settlements are requested.' },
];

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-bg-primary relative overflow-hidden">
            {/* Glow */}
            <div className="fixed top-[-200px] left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-[radial-gradient(circle,rgba(99,102,241,0.15)_0%,transparent_70%)] pointer-events-none" />

            {/* Nav */}
            <nav className="flex items-center justify-between px-15 py-5 relative z-10">
                <div className="flex items-center gap-2.5 text-[1.4rem] font-extrabold tracking-tight">
                    <div className="w-9 h-9 bg-gradient-to-br from-accent to-accent-light rounded-[10px] flex items-center justify-center text-lg">✂</div>
                    Split<span className="text-text-secondary font-normal">It</span>
                </div>
                <div className="flex items-center gap-8">
                    <a href="#features" className="text-text-secondary text-sm hover:text-text-primary transition">Features</a>
                    <a href="#pricing" className="text-text-secondary text-sm hover:text-text-primary transition">Pricing</a>
                    <a href="#about" className="text-text-secondary text-sm hover:text-text-primary transition">About</a>
                </div>
                <div className="flex gap-3">
                    <Link to="/auth" className="inline-flex items-center px-5 py-2.5 rounded-[10px] text-sm font-semibold text-text-secondary hover:bg-white/5 hover:text-text-primary transition">Sign In</Link>
                    <Link to="/auth" className="inline-flex items-center px-5 py-2.5 rounded-[10px] text-sm font-semibold bg-accent text-white hover:bg-[#5254cc] hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(99,102,241,0.2)] transition">Get Started Free</Link>
                </div>
            </nav>

            {/* Hero */}
            <div className="flex flex-col items-center justify-center text-center px-10 pt-25 pb-15 relative z-[1]">
                <div className="inline-flex items-center gap-2 bg-accent-dim border border-[rgba(99,102,241,0.3)] text-accent-light px-4 py-1.5 rounded-full text-xs font-medium mb-7 animate-fade-down">
                    <span className="w-1.5 h-1.5 bg-green rounded-full" />
                    Now with AI-powered settlement optimization
                </div>
                <h1 className="text-[clamp(2.8rem,6vw,5rem)] font-extrabold leading-[1.1] tracking-[-2px] mb-6 animate-fade-down">
                    Split expenses.<br />
                    <span className="bg-gradient-to-br from-accent-light via-[#a78bfa] to-[#60a5fa] bg-clip-text text-transparent">Zero friction.</span>
                </h1>
                <p className="text-lg text-text-secondary max-w-[560px] leading-relaxed mb-11 animate-fade-down">
                    The modern way to manage shared costs for groups, trips &amp; projects — with real-time balances, receipt tracking, and instant settlements.
                </p>
                <div className="flex items-center gap-4 animate-fade-down">
                    <Link to="/auth" className="inline-flex items-center px-7 py-3.5 rounded-[10px] text-[0.95rem] font-semibold bg-accent text-white hover:bg-[#5254cc] hover:-translate-y-0.5 hover:shadow-[0_0_20px_rgba(99,102,241,0.2)] transition">Start for Free →</Link>
                    <Link to="/dashboard" className="inline-flex items-center px-7 py-3.5 rounded-[10px] text-[0.95rem] font-semibold bg-bg-card text-text-primary border border-border hover:bg-bg-card-hover hover:border-white/10 transition">View Demo</Link>
                </div>
                <div className="flex gap-12 mt-20 pt-15 border-t border-border animate-fade-up">
                    <div className="text-center"><div className="text-3xl font-extrabold">50K+</div><div className="text-sm text-text-secondary mt-1">Active Groups</div></div>
                    <div className="text-center"><div className="text-3xl font-extrabold">₹2.4Cr</div><div className="text-sm text-text-secondary mt-1">Settled Daily</div></div>
                    <div className="text-center"><div className="text-3xl font-extrabold">4.9★</div><div className="text-sm text-text-secondary mt-1">User Rating</div></div>
                </div>
            </div>

            {/* Features */}
            <section id="features" className="px-15 py-20 grid grid-cols-3 gap-6 max-w-[1200px] mx-auto">
                {features.map(f => (
                    <div key={f.title} className="bg-bg-card border border-border rounded-[20px] p-8 hover:border-[rgba(99,102,241,0.3)] hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(0,0,0,0.6)] transition-all">
                        <div className="w-12 h-12 rounded-[10px] flex items-center justify-center text-[22px] mb-5" style={{ background: f.bg }}>{f.icon}</div>
                        <h3 className="font-semibold mb-2.5">{f.title}</h3>
                        <p className="text-text-secondary text-sm leading-relaxed">{f.desc}</p>
                    </div>
                ))}
            </section>

            <footer className="text-center py-10 text-text-muted text-sm border-t border-border">
                © 2026 SplitIt Technologies Pvt. Ltd. · Privacy · Terms · Support
            </footer>
        </div>
    );
}
