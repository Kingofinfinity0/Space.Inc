import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, Info, Loader2 } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'loading';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => string;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);

        if (type !== 'loading') {
            setTimeout(() => {
                removeToast(id);
            }, 5000);
        }

        return id;
    }, [removeToast]);

    return (
        <ToastContext.Provider value={{ showToast, removeToast }}>
            {children}
            <div className="fixed top-20 right-4 z-[700] flex flex-col gap-2 pointer-events-none max-h-[calc(100vh-120px)] overflow-y-auto">
                {toasts.map((toast) => (
                    <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
                ))}
            </div>
        </ToastContext.Provider>
    );
};

const ToastItem: React.FC<{ toast: Toast; onRemove: () => void }> = ({ toast, onRemove }) => {
    const getIcon = () => {
        switch (toast.type) {
            case 'success': return <CheckCircle className="text-emerald-500" size={18} />;
            case 'error': return <AlertCircle className="text-rose-500" size={18} />;
            case 'loading': return <Loader2 className="text-[#0D0D0D] animate-spin" size={18} />;
            default: return <Info className="text-[#0D0D0D]" size={18} />;
        }
    };

    return (
            <div className="toast-item pointer-events-auto flex items-center gap-3 px-4 py-3 bg-white border border-[#E5E5E5] shadow-[0_1px_3px_rgba(0,0,0,0.06)] rounded-[8px] min-w-[300px] max-w-[400px] animate-slide-in">
            <div className="flex-shrink-0">
                {getIcon()}
            </div>
            <div className="flex-1">
                <p className="text-sm font-medium text-zinc-800">{toast.message}</p>
            </div>
            <button
                onClick={onRemove}
                className="text-zinc-400 hover:text-zinc-600 transition-colors"
            >
                <X size={16} />
            </button>
        </div>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (context === undefined) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
