import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PARTICIPANTS as INITIAL_PARTICIPANTS } from '../data/mockData';
import { useToast } from '../components/ToastProvider';

export default function AddExpensePage() {
    const [amount, setAmount] = useState('');
    const [desc, setDesc] = useState('');
    const [category, setCategory] = useState('🍽️ Food & Dining');
    const [group, setGroup] = useState('🏖 Goa Trip 2026');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [paidBy, setPaidBy] = useState('Priya Sharma (You)');
    const [splitType, setSplitType] = useState('equal');
    const [participants, setParticipants] = useState(INITIAL_PARTICIPANTS.map(p => ({ ...p })));
    const [fileName, setFileName] = useState('');
    const showToast = useToast();
    const navigate = useNavigate();

    const toggleParticipant = (idx) => {
        setParticipants(prev => prev.map((p, i) => i === idx ? { ...p, selected: !p.selected } : p));
    };

    const selectAll = () => setParticipants(prev => prev.map(p => ({ ...p, selected: true })));

    const selected = participants.filter(p => p.selected);
    const perPerson = selected.length > 0 && Number(amount) > 0 ? Math.round(Number(amount) / selected.length) : 0;

    const handleDragOver = useCallback(e => { e.preventDefault(); e.currentTarget.classList.add('border-accent', 'bg-accent-dim'); }, []);
    const handleDragLeave = useCallback(e => { e.currentTarget.classList.remove('border-accent', 'bg-accent-dim'); }, []);
    const handleDrop = useCallback(e => { e.preventDefault(); e.currentTarget.classList.remove('border-accent', 'bg-accent-dim'); if (e.dataTransfer.files[0]) setFileName(e.dataTransfer.files[0].name); }, []);
    const handleFileSelect = (e) => { if (e.target.files[0]) setFileName(e.target.files[0].name); };

    const submit = () => {
        if (!amount || !desc) { showToast('error', 'Missing Info', 'Please fill amount and description'); return; }
        showToast('success', 'Expense Submitted!', `₹${Number(amount).toLocaleString()} — "${desc}" sent for approval`);
        setTimeout(() => navigate('/expenses'), 1200);
    };

    const splitTypes = [
        { key: 'equal', icon: '⚖️', label: 'Equal', desc: 'Split evenly' },
        { key: 'custom', icon: '✏️', label: 'Custom', desc: 'Set amounts' },
        { key: 'percent', icon: '%', label: 'Percentage', desc: 'By ratio' },
    ];

    return (
        <div className="animate-fade-in">
            <div className="flex items-center gap-3 mb-7">
                <Link to="/expenses" className="px-2.5 py-2.5 rounded-[10px] text-text-secondary hover:bg-white/5 hover:text-text-primary transition">←</Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Add New Expense</h1>
                    <p className="text-text-secondary text-sm mt-1">Fill in the details below to log a shared expense</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-5 items-start">
                {/* Left Column */}
                <div className="flex flex-col gap-6">
                    {/* Amount Input */}
                    <div className="text-center p-9 bg-bg-card border border-border rounded-[20px]">
                        <div>
                            <span className="text-4xl font-light text-text-muted align-top mt-3 inline-block">₹</span>
                            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="bg-transparent border-none outline-none text-6xl font-extrabold text-text-primary w-[280px] text-center tracking-[-2px]" />
                        </div>
                        <div className="text-text-muted text-sm mt-2">Enter expense amount</div>
                    </div>

                    {/* Details Card */}
                    <div className="bg-bg-card border border-border rounded-[20px] p-6">
                        <div className="text-[0.95rem] font-semibold mb-5">Expense Details</div>
                        <div className="mb-5">
                            <label className="block text-sm text-text-secondary font-medium mb-2">Description</label>
                            <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g., Hotel booking, Dinner..." className="w-full bg-bg-input border border-border text-text-primary px-4 py-3 rounded-[10px] text-[0.95rem] outline-none focus:border-accent transition placeholder:text-text-muted" />
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-5">
                            <div>
                                <label className="block text-sm text-text-secondary font-medium mb-2">Category</label>
                                <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-bg-input border border-border text-text-primary px-4 py-3 rounded-[10px] text-[0.95rem] outline-none focus:border-accent transition cursor-pointer appearance-none">
                                    {['🍽️ Food & Dining', '🏨 Accommodation', '🚗 Transport', '🎉 Entertainment', '🛒 Shopping', '💊 Health', '📦 Other'].map(c => <option key={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-text-secondary font-medium mb-2">Group</label>
                                <select value={group} onChange={e => setGroup(e.target.value)} className="w-full bg-bg-input border border-border text-text-primary px-4 py-3 rounded-[10px] text-[0.95rem] outline-none focus:border-accent transition cursor-pointer appearance-none">
                                    {['🏖 Goa Trip 2026', '🏠 Flat Expenses', '🍕 Office Lunch', '🎓 College Friends'].map(g => <option key={g}>{g}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-text-secondary font-medium mb-2">Date</label>
                                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-bg-input border border-border text-text-primary px-4 py-3 rounded-[10px] text-[0.95rem] outline-none focus:border-accent transition" />
                            </div>
                            <div>
                                <label className="block text-sm text-text-secondary font-medium mb-2">Paid By</label>
                                <select value={paidBy} onChange={e => setPaidBy(e.target.value)} className="w-full bg-bg-input border border-border text-text-primary px-4 py-3 rounded-[10px] text-[0.95rem] outline-none focus:border-accent transition cursor-pointer appearance-none">
                                    {['Priya Sharma (You)', 'Rohan Kumar', 'Anita Desai', 'Ketan Shah'].map(p => <option key={p}>{p}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Receipt Upload */}
                    <div className="bg-bg-card border border-border rounded-[20px] p-6">
                        <div className="text-[0.95rem] font-semibold mb-4">Receipt / Proof</div>
                        <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className="border-2 border-dashed border-border rounded-[20px] py-12 px-8 text-center cursor-pointer transition-all relative hover:border-accent hover:bg-accent-dim">
                            <input type="file" accept="image/*,.pdf" onChange={handleFileSelect} className="absolute inset-0 opacity-0 cursor-pointer" />
                            <div className="text-4xl mb-4">{fileName ? '✅' : '📎'}</div>
                            <div className="text-[0.95rem] font-semibold mb-1.5">{fileName || 'Drag & drop receipt here'}</div>
                            <div className="text-xs text-text-muted">{fileName || 'or click to browse · PNG, JPG, PDF up to 10MB'}</div>
                        </div>
                        {fileName && (
                            <div className="mt-3 flex items-center gap-2.5 bg-green-dim border border-[rgba(34,197,94,0.3)] rounded-[10px] px-3.5 py-2.5">
                                <span>📄</span>
                                <span className="text-sm flex-1 truncate">{fileName}</span>
                                <span className="text-green text-xs">✓ Ready</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column */}
                <div className="flex flex-col gap-6">
                    {/* Split Type */}
                    <div className="bg-bg-card border border-border rounded-[20px] p-6">
                        <div className="text-[0.95rem] font-semibold mb-4">Split Method</div>
                        <div className="flex gap-3">
                            {splitTypes.map(s => (
                                <button key={s.key} onClick={() => setSplitType(s.key)} className={`flex-1 p-4 rounded-[14px] text-center transition border ${splitType === s.key ? 'border-accent bg-accent-dim' : 'border-border bg-bg-card hover:border-[rgba(99,102,241,0.3)]'}`}>
                                    <div className="text-2xl mb-2">{s.icon}</div>
                                    <div className="text-xs font-semibold">{s.label}</div>
                                    <div className="text-[0.75rem] text-text-muted mt-1">{s.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Participants */}
                    <div className="bg-bg-card border border-border rounded-[20px] p-6">
                        <div className="flex items-center justify-between mb-5">
                            <div className="text-[0.95rem] font-semibold">Select Participants</div>
                            <button onClick={selectAll} className="text-xs text-text-secondary hover:bg-white/5 px-3 py-1 rounded-md transition">Select All</button>
                        </div>
                        <div className="flex flex-col gap-2">
                            {participants.map((p, i) => (
                                <div key={i} onClick={() => toggleParticipant(i)} className={`flex items-center gap-3 px-4 py-3 rounded-[10px] border cursor-pointer transition ${p.selected ? 'border-accent bg-accent-dim' : 'border-border hover:border-[rgba(99,102,241,0.3)]'}`}>
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: p.color }}>{p.initials}</div>
                                    <div className="flex-1 text-sm font-medium">{p.name}</div>
                                    <div className="text-sm text-text-muted">{p.selected && perPerson > 0 ? `₹${perPerson}` : ''}</div>
                                    <div className={`w-5 h-5 rounded-[6px] border-2 flex items-center justify-center transition text-xs ${p.selected ? 'bg-accent border-accent text-white' : 'border-border'}`}>{p.selected ? '✓' : ''}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <Link to="/expenses" className="flex-1 text-center px-5 py-2.5 rounded-[10px] text-sm font-semibold bg-bg-card text-text-primary border border-border hover:bg-bg-card-hover transition">Cancel</Link>
                        <button onClick={submit} className="flex-[2] px-5 py-2.5 rounded-[10px] text-sm font-semibold bg-accent text-white hover:bg-[#5254cc] transition">Submit Expense →</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
