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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 backdrop-blur-[10px] md:items-center">
      <div className="glass-surface glass-elevated sheet-enter w-full max-w-xl overflow-hidden rounded-[8px]">
        <div className="flex items-center justify-between border-b border-[#DADADA] px-6 py-5">
          {title && <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#0D0D0D]">{title}</h2>}
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-[#DADADA] bg-white text-[#6E6E80] hover:bg-[#F7F7F8] hover:text-[#0D0D0D] active:scale-95"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-6 text-[#0D0D0D]">
          {children}
        </div>
      </div>
    </div>
  );
};
