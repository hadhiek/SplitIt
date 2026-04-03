import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function useToast() {
    return useContext(ToastContext);
}

let toastId = 0;
const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((type, title, message) => {
        const id = ++toastId;
        setToasts(prev => [...prev, { id, type, title, message }]);
        setTimeout(() => removeToast(id), 4000);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.map(t => t.id === id ? { ...t, removing: true } : t));
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300);
    }, []);

    return (
        <ToastContext.Provider value={showToast}>
            {children}
            <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5">
                {toasts.map(t => (
                    <div
                        key={t.id}
                        className={`min-w-[300px] max-w-[380px] bg-bg-card border border-border rounded-[14px] px-[18px] py-3.5 flex items-start gap-3 shadow-[0_8px_32px_rgba(0,0,0,0.6)] ${t.removing ? 'animate-slide-out' : 'animate-slide-in'} ${t.type === 'success' ? 'border-l-[3px] border-l-green' : t.type === 'error' ? 'border-l-[3px] border-l-red' : t.type === 'warning' ? 'border-l-[3px] border-l-yellow' : 'border-l-[3px] border-l-accent'}`}
                    >
                        <span className="text-lg shrink-0 mt-0.5">{icons[t.type] || 'ℹ️'}</span>
                        <div className="flex-1">
                            <div className="text-sm font-semibold mb-0.5">{t.title}</div>
                            <div className="text-xs text-text-secondary">{t.message}</div>
                        </div>
                        <button onClick={() => removeToast(t.id)} className="bg-transparent border-none text-text-muted hover:text-text-primary text-base cursor-pointer p-0 transition">×</button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
