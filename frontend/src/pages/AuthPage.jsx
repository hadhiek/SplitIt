import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/ToastProvider';
import { supabase } from '../lib/supabase';

export default function AuthPage() {
    const [tab, setTab] = useState('login');
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [signupData, setSignupData] = useState({ first: '', last: '', email: '', password: '', role: 'Member' });
    const [loading, setLoading] = useState(false);
    
    const navigate = useNavigate();
    const showToast = useToast();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        const { data, error } = await supabase.auth.signInWithPassword({
            email: loginEmail,
            password: loginPassword,
        });

        if (error) {
            showToast('error', 'Login Failed', error.message);
        } else {
            showToast('success', 'Welcome back!', `Signed in successfully`);
            navigate('/dashboard');
        }
        setLoading(false);
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        setLoading(true);
        const { data, error } = await supabase.auth.signUp({
            email: signupData.email,
            password: signupData.password,
            options: {
                data: {
                    full_name: `${signupData.first} ${signupData.last}`
                }
            }
        });

        if (error) {
            showToast('error', 'Signup Failed', error.message);
        } else {
            showToast('success', 'Account Created!', 'Welcome to SplitIt');
            navigate('/dashboard');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen grid grid-cols-2 bg-bg-primary">
            {/* Left Panel */}
            <div className="bg-gradient-to-br from-[#0f1624] to-[#1a1040] p-15 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-[-100px] right-[-100px] w-[400px] h-[400px] bg-[radial-gradient(circle,rgba(99,102,241,0.25)_0%,transparent_70%)]" />
                <div className="absolute bottom-[-100px] left-[-100px] w-[300px] h-[300px] bg-[radial-gradient(circle,rgba(96,165,250,0.15)_0%,transparent_70%)]" />

                <div className="flex items-center gap-2.5 text-white">
                    <div className="w-8 h-8 bg-gradient-to-br from-accent to-accent-light rounded-[10px] flex items-center justify-center text-base">✂</div>
                    <span className="text-xl font-extrabold">SplitIt</span>
                </div>

                <div className="relative z-[1] mt-10">
                    <h2 className="text-[2.2rem] font-extrabold leading-tight mb-4">Manage shared expenses with clarity and confidence.</h2>
                    <p className="text-text-secondary text-base leading-relaxed mt-4">SplitIt brings structure to group finances — whether it's a weekend trip, a flat, or a project team.</p>
                    <div className="flex flex-col gap-3.5 mt-9">
                        {['Real-time balance tracking across groups', 'Receipt upload & admin approval workflow', 'Settlement optimization with visual graph'].map(text => (
                            <div key={text} className="flex items-center gap-3 text-sm text-text-secondary">
                                <span className="w-7 h-7 rounded-full bg-green-dim text-green flex items-center justify-center shrink-0 text-sm">✓</span>
                                {text}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="relative z-[1] bg-white/5 border border-border rounded-[14px] p-5">
                    <p className="italic text-text-secondary text-sm mb-3">"SplitIt saved our trip planning. No more messy spreadsheets or awkward 'who paid what' conversations."</p>
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-semibold">RK</div>
                        <span className="text-sm font-medium">Rohan K. — Bangalore Tech Trip 2026</span>
                    </div>
                </div>
            </div>

            {/* Right Panel */}
            <div className="flex items-center justify-center p-10">
                <div className="w-full max-w-[440px]">
                    <div className="flex items-center gap-2.5 mb-8">
                        <div className="w-8 h-8 bg-gradient-to-br from-accent to-accent-light rounded-[10px] flex items-center justify-center text-base">✂</div>
                        <span className="text-xl font-extrabold">SplitIt</span>
                    </div>

                    {/* Tabs */}
                    <div className="flex bg-bg-card rounded-[10px] p-1 gap-1 mb-8">
                        <button onClick={() => setTab('login')} className={`flex-1 py-2.5 rounded-[6px] text-sm font-medium transition ${tab === 'login' ? 'bg-accent text-white' : 'text-text-secondary'}`}>Sign In</button>
                        <button onClick={() => setTab('signup')} className={`flex-1 py-2.5 rounded-[6px] text-sm font-medium transition ${tab === 'signup' ? 'bg-accent text-white' : 'text-text-secondary'}`}>Create Account</button>
                    </div>

                    {tab === 'login' ? (
                        <form onSubmit={handleLogin}>
                            <div className="mb-5">
                                <label className="block text-sm text-text-secondary font-medium mb-2">Email Address</label>
                                <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="you@example.com" className="w-full bg-bg-input border border-border text-text-primary px-4 py-3 rounded-[10px] text-[0.95rem] outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)] transition placeholder:text-text-muted" />
                            </div>
                            <div className="mb-5">
                                <label className="block text-sm text-text-secondary font-medium mb-2">Password</label>
                                <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="••••••••" className="w-full bg-bg-input border border-border text-text-primary px-4 py-3 rounded-[10px] text-[0.95rem] outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)] transition placeholder:text-text-muted" />
                            </div>
                            <div className="flex justify-end -mt-2 mb-5">
                                <a className="text-xs text-accent-light cursor-pointer">Forgot password?</a>
                            </div>
                            <button type="submit" disabled={loading} className="w-full px-5 py-3.5 rounded-[10px] text-[0.95rem] font-semibold bg-accent text-white hover:bg-[#5254cc] hover:-translate-y-0.5 transition disabled:opacity-50">
                                {loading ? 'Signing in...' : 'Sign In to SplitIt'}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleSignup}>
                            <div className="grid grid-cols-2 gap-4 mb-5">
                                <div>
                                    <label className="block text-sm text-text-secondary font-medium mb-2">First Name</label>
                                    <input type="text" value={signupData.first} onChange={e => setSignupData(p => ({ ...p, first: e.target.value }))} placeholder="Priya" className="w-full bg-bg-input border border-border text-text-primary px-4 py-3 rounded-[10px] text-[0.95rem] outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)] transition placeholder:text-text-muted" />
                                </div>
                                <div>
                                    <label className="block text-sm text-text-secondary font-medium mb-2">Last Name</label>
                                    <input type="text" value={signupData.last} onChange={e => setSignupData(p => ({ ...p, last: e.target.value }))} placeholder="Sharma" className="w-full bg-bg-input border border-border text-text-primary px-4 py-3 rounded-[10px] text-[0.95rem] outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)] transition placeholder:text-text-muted" />
                                </div>
                            </div>
                            <div className="mb-5">
                                <label className="block text-sm text-text-secondary font-medium mb-2">Email Address</label>
                                <input type="email" value={signupData.email} onChange={e => setSignupData(p => ({ ...p, email: e.target.value }))} placeholder="priya@example.com" className="w-full bg-bg-input border border-border text-text-primary px-4 py-3 rounded-[10px] text-[0.95rem] outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)] transition placeholder:text-text-muted" />
                            </div>
                            <div className="mb-5">
                                <label className="block text-sm text-text-secondary font-medium mb-2">Password</label>
                                <input type="password" value={signupData.password} onChange={e => setSignupData(p => ({ ...p, password: e.target.value }))} placeholder="Min. 8 characters" className="w-full bg-bg-input border border-border text-text-primary px-4 py-3 rounded-[10px] text-[0.95rem] outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)] transition placeholder:text-text-muted" />
                            </div>
                            <button type="submit" disabled={loading} className="w-full px-5 py-3.5 rounded-[10px] text-[0.95rem] font-semibold bg-accent text-white hover:bg-[#5254cc] hover:-translate-y-0.5 transition disabled:opacity-50">
                                {loading ? 'Creating...' : 'Create Account'}
                            </button>
                            <p className="text-center mt-4 text-xs text-text-muted">By signing up you agree to our <a className="text-accent-light">Terms</a> & <a className="text-accent-light">Privacy Policy</a>.</p>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
