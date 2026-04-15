import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-4 backdrop-blur-[10px] md:items-center">
      <div className="glass-surface glass-elevated w-full max-w-xl rounded-[28px] page-enter overflow-hidden border border-white/10 bg-[rgba(12,15,20,0.88)]">
        <div className="flex items-center justify-between border-b border-white/8 px-6 py-5">
          {title && <h2 className="text-xl font-semibold tracking-[-0.03em] text-white">{title}</h2>}
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/8 bg-white/[0.06] text-slate-200 hover:bg-white/[0.12] hover:text-white active:scale-95"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-6 text-slate-100">
          {children}
        </div>
      </div>
    </div>
  );
};
