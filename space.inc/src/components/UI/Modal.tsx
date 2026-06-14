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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-[var(--space-inset-card-sm)] backdrop-blur-[10px] md:items-center">
      <div className="glass-surface glass-elevated sheet-enter w-full max-w-xl overflow-hidden rounded-[var(--radius-md)]">
        <div className="flex items-center justify-between border-b border-[color:var(--color-border-strong)] px-[var(--space-inset-card-md)] py-[var(--space-5)]">
          {title && <h2 className="text-[length:var(--font-size-title)] font-semibold tracking-[var(--tracking-section)] text-[color:var(--text-primary)]">{title}</h2>}
          <button
            onClick={onClose}
            className="flex h-[var(--size-control-md)] w-[var(--size-control-md)] items-center justify-center rounded-[var(--radius-md)] border border-[color:var(--color-border-strong)] bg-[color:var(--bg-base)] text-[color:var(--text-muted)] hover:bg-[color:var(--bg-hover)] hover:text-[color:var(--text-primary)] active:scale-95"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-[var(--space-inset-card-md)] py-[var(--space-inset-card-md)] text-[color:var(--text-primary)]">
          {children}
        </div>
      </div>
    </div>
  );
};
